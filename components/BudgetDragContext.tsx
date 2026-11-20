import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import useBudgetStore from "../store/useBudgetStore";
import { budgetAtPoint, budgetDragScroll, type BudgetDropRect, type DropRect } from "../utils/budgetDrop";
import { Colors } from "../constants/Colors";
import { currencySettings } from "../types/settings";

export type DragExpense = { budgetId: string; rowId: string; name: string; amount: number };
type DragSession = { expense: DragExpense; grabX: number; grabY: number; width: number; height: number; startOffset: number; finishing: boolean };
type DropResult = { kind: "reorder"; scrollDelta: number } | { kind: "cancel" | "moved" };
export type BudgetDragControls = {
  begin: (expense: DragExpense, x: number, y: number, grabX: number, grabY: number, width: number, height: number) => void;
  update: (x: number, y: number) => void;
  finish: (x: number, y: number) => Promise<DropResult>;
  cancel: () => void;
};
export type BudgetDragListEvents = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (width: number, height: number) => void;
};
export const BudgetDragListContext = createContext<BudgetDragListEvents | null>(null);
export const BudgetDragContext = createContext<BudgetDragControls | null>(null);
const DropTargetContext = createContext<{
  register: (id: string, view: NativeView | null) => void;
  sourceId: string | null;
  targetId: string | null;
} | null>(null);

type NativeView = React.ComponentRef<typeof View>;
type ListHandle = { scrollToOffset: (options: { offset: number; animated: boolean }) => void };

/** One drag session spans the list, so the preview can cross card boundaries. */
export function BudgetDragProvider({ children, listRef }: {
  children: React.ReactNode;
  listRef: React.RefObject<ListHandle | null>;
}) {
  const root = useRef<NativeView>(null);
  const targets = useRef(new Map<string, NativeView>());
  const rects = useRef<BudgetDropRect[]>([]);
  const viewport = useRef<DropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const session = useRef<DragSession | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState<DragSession | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const previewX = useSharedValue(0);
  const previewY = useSharedValue(0);
  const settings = useBudgetStore(state => state.settings);
  const colors = Colors[settings?.theme ?? "dark"];
  const { symbol, decimals } = currencySettings[settings?.currency ?? "CAD"];

  const controls = useMemo(() => {
    const highlight = () => setTargetId(budgetAtPoint(rects.current, pointer.current.x, pointer.current.y, viewport.current));
    const reset = () => {
      session.current = null;
      if (!mounted.current) return;
      setActive(null); setTargetId(null); setSaving(false);
    };
    const measureTargets = async () => {
      const measured = await Promise.all([...targets.current].map(([budgetId, view]) => new Promise<BudgetDropRect | null>(resolve => {
        // A virtualized cell may disappear while measurement is in flight.
        const timeout = setTimeout(() => resolve(null), 150);
        view.measureInWindow((x, y, width, height) => {
          clearTimeout(timeout);
          resolve(targets.current.get(budgetId) === view && width > 0 && height > 0 ? { budgetId, x, y, width, height } : null);
        });
      })));
      return measured.filter((rect): rect is BudgetDropRect => rect !== null);
    };
    return {
      begin(expense: DragExpense, x: number, y: number, grabX: number, grabY: number, width: number, height: number) {
        if (session.current) return;
        const next = { expense, grabX, grabY, width, height, startOffset: offset.current, finishing: false };
        session.current = next;
        pointer.current = { x, y };
        previewX.set(x - grabX - viewport.current.x);
        previewY.set(y - grabY - viewport.current.y);
        setActive(next);
        void measureTargets().then(measured => {
          if (!mounted.current || session.current !== next || next.finishing) return;
          rects.current = measured; highlight();
        });
      },
      update(x: number, y: number) {
        const current = session.current;
        if (!current || current.finishing) return;
        pointer.current = { x, y };
        previewX.set(x - current.grabX - viewport.current.x);
        previewY.set(y - current.grabY - viewport.current.y);
        highlight();
      },
      async finish(x: number, y: number): Promise<DropResult> {
        const current = session.current;
        if (!current || current.finishing) return { kind: "cancel" };
        current.finishing = true;
        // Stop edge scrolling before measuring the final drop position.
        const measured = await measureTargets();
        if (!mounted.current || session.current !== current) return { kind: "cancel" };
        const destination = budgetAtPoint(measured, x, y, viewport.current);
        if (destination === current.expense.budgetId) {
          const scrollDelta = offset.current - current.startOffset;
          reset();
          return { kind: "reorder", scrollDelta };
        }
        if (!destination) { reset(); return { kind: "cancel" }; }
        setSaving(true);
        try {
          const state = useBudgetStore.getState();
          const bill = state.budgets.find(budget => budget.id === current.expense.budgetId)?.bills.find(item => item.id === current.expense.rowId);
          if (!bill) throw new Error("Expense occurrence not found");
          await state.moveExpenseBetweenBudgets(current.expense.budgetId, destination, bill.expense.id, bill.id, bill.amount);
          AccessibilityInfo.announceForAccessibility(`Moved ${bill.expense.name} to another budget.`);
        } catch {
          Alert.alert("Unable to move expense", "Your previous budgets are unchanged. Please try again.");
        } finally { reset(); }
        return { kind: "moved" };
      },
      cancel() { if (!session.current?.finishing) reset(); },
      async remeasure() {
        const current = session.current;
        const measured = await measureTargets();
        if (!mounted.current || !current || session.current !== current || current.finishing) return;
        rects.current = measured; highlight();
      },
    };
  }, [previewX, previewY]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; session.current = null; };
  }, []);

  useEffect(() => {
    if (!active || saving) return;
    let ticks = 0;
    const timer = setInterval(() => {
      if (!session.current || session.current.finishing) return;
      const nextOffset = budgetDragScroll(pointer.current.y, viewport.current, offset.current, contentHeight.current);
      if (nextOffset !== offset.current && pointer.current.x >= viewport.current.x && pointer.current.x <= viewport.current.x + viewport.current.width) {
        listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
      }
      if (++ticks % 5 === 0) void controls.remeasure();
    }, 16);
    return () => clearInterval(timer);
  }, [active, controls, listRef, saving]);

  const register = useCallback((id: string, view: NativeView | null) => {
    if (view) targets.current.set(id, view);
    else targets.current.delete(id);
  }, []);
  const targetState = useMemo(() => ({ register, sourceId: active?.expense.budgetId ?? null, targetId }), [active, register, targetId]);
  const previewStyle = useAnimatedStyle(() => ({ transform: [{ translateX: previewX.value }, { translateY: previewY.value }] }));

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y;
    const delta = next - offset.current;
    offset.current = next;
    rects.current = rects.current.map(rect => ({ ...rect, y: rect.y - delta }));
    controls.update(pointer.current.x, pointer.current.y);
  }, [controls]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.current = height;
  }, []);

  return (
    <BudgetDragContext.Provider value={controls}>
      <DropTargetContext.Provider value={targetState}>
        <View testID="budget-drag-viewport" ref={root} style={styles.container} onLayout={() => root.current?.measureInWindow((x, y, width, height) => { viewport.current = { x, y, width, height }; })}>
          <BudgetDragListContext.Provider value={{ onScroll, onContentSizeChange }}>{children}</BudgetDragListContext.Provider>
          {active && <Animated.View testID="budget-drag-preview" pointerEvents="none" style={[styles.preview, { width: active.width, minHeight: active.height, backgroundColor: colors.draggingRow, borderColor: colors.tabIconSelected }, previewStyle]}>
            <Text style={{ color: colors.text, fontWeight: "bold" }}>{active.expense.name}</Text>
            <Text style={{ color: colors.text }}>{symbol}{active.expense.amount.toFixed(decimals)}</Text>
            <Text style={{ color: colors.text }}>{saving ? "Moving expense…" : targetId && targetId !== active.expense.budgetId ? "Release to move to this budget" : "Drag onto another budget to move"}</Text>
          </Animated.View>}
          {saving && <View style={styles.saving} accessibilityLabel="Moving expense" accessibilityViewIsModal><ActivityIndicator color={colors.text} /></View>}
        </View>
      </DropTargetContext.Provider>
    </BudgetDragContext.Provider>
  );
}

export function BudgetDropTarget({ budgetId, children }: { budgetId: string; children: React.ReactNode }) {
  const context = useContext(DropTargetContext);
  const register = context?.register;
  const ref = useCallback((view: NativeView | null) => register?.(budgetId, view), [budgetId, register]);
  const highlighted = context?.targetId === budgetId && context.sourceId !== budgetId;
  return <View testID={`budget-drop-${budgetId}`} ref={ref} collapsable={false} style={[styles.card, highlighted && styles.target]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginBottom: 16 },
  target: { borderRadius: 10, outlineColor: "#46A89A", outlineWidth: 3, outlineStyle: "solid" },
  preview: { position: "absolute", top: 0, left: 0, borderWidth: 2, borderRadius: 8, padding: 10, opacity: 0.95, zIndex: 100, elevation: 12 },
  saving: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 101, alignItems: "center", justifyContent: "center" },
});
