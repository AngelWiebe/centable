import React, { useCallback, useContext, useLayoutEffect, useMemo } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { BudgetDragContext, type DragExpense } from "./BudgetDragContext";
import { BudgetScrollContext } from "./BudgetScrollContext";

type SharedNumber = ReturnType<typeof useSharedValue<number>>;

const ROW_GAP = 16;

export default function DraggableExpenseRow({
  expense,
  index,
  count,
  dragY,
  activeIndex,
  activeHeight,
  settled,
  onReorder,
  cardColor,
  dragColor,
  accentColor,
  enabled,
  children,
}: {
  expense: DragExpense;
  index: number;
  count: number;
  dragY: SharedNumber;
  activeIndex: SharedNumber;
  activeHeight: SharedNumber;
  settled: SharedNumber;
  onReorder: (from: number, to: number) => void;
  cardColor: string;
  dragColor: string;
  accentColor: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const scroll = useContext(BudgetScrollContext);
  const crossBudgetDrag = useContext(BudgetDragContext);
  const hasCrossBudgetDrag = crossBudgetDrag !== null;
  const stableExpense = useMemo(() => ({ budgetId: expense.budgetId, rowId: expense.rowId, name: expense.name, amount: expense.amount }), [expense.budgetId, expense.rowId, expense.name, expense.amount]);
  const rowWidth = useSharedValue(0);
  const held = useSharedValue(0);
  const origin = useSharedValue(-1);
  const lifted = useSharedValue(0);
  const slot = useSharedValue(index);
  const shift = useSharedValue(0);
  const grabY = useSharedValue(0);
  const indexSV = useSharedValue(index);
  // Update before paint so the release offset shrinks by the same amount
  // the row's layout slot moves.
  useLayoutEffect(() => {
    indexSV.set(index);
  }, [index, indexSV]);

  const finishDrag = useCallback(async (x: number, y: number, releasedTranslation: number) => {
    const result = crossBudgetDrag ? await crossBudgetDrag.finish(x, y) : { kind: "reorder" as const, scrollDelta: 0 };
    if (result.kind !== "reorder") {
      dragY.set(0); activeIndex.set(-1); lifted.set(0);
      return;
    }
    const scrollDelta = result.scrollDelta;
    const step = activeHeight.value + ROW_GAP;
    const from = index;
    const translation = releasedTranslation + scrollDelta;
    if (step <= ROW_GAP) {
      dragY.set(0);
      activeIndex.set(-1);
      lifted.set(0);
      return;
    }
    const to = Math.max(
      0,
      Math.min(count - 1, from + Math.round(translation / step))
    );
    const delta = (to - from) * step;
    dragY.set(withTiming(delta, { duration: 140 }, (finished) => {
      if (!finished) return;
      if (from === to) {
        activeIndex.set(-1);
        lifted.set(0);
        return;
      }
      held.set(delta);
      settled.set(1);
      runOnJS(onReorder)(from, to);
    }));
  }, [activeHeight, activeIndex, count, crossBudgetDrag, dragY, held, index, lifted, onReorder, settled]);

  const gesture = useMemo(() => {
    const setScrollEnabled = scroll?.setScrollEnabled;
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activateAfterLongPress(220)
      .shouldCancelWhenOutside(false)
      .onStart((event) => {
        // Translation includes movement from the initial touch. Keep the row
        // where it was when the long press actually grabbed it.
        grabY.set(event.translationY);
        if (crossBudgetDrag) runOnJS(crossBudgetDrag.begin)(stableExpense, event.absoluteX, event.absoluteY, event.x, event.y, rowWidth.value, activeHeight.value);
        dragY.set(0);
        activeIndex.set(index);
        lifted.set(1);
        if (setScrollEnabled) runOnJS(setScrollEnabled)(false);
      })
      .onUpdate((event) => {
        dragY.set(event.translationY - grabY.value);
        if (crossBudgetDrag) runOnJS(crossBudgetDrag.update)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        runOnJS(finishDrag)(event.absoluteX, event.absoluteY, event.translationY - grabY.value);
      })
      .onFinalize((_event, success) => {
        if (setScrollEnabled) runOnJS(setScrollEnabled)(true);
        if (success || activeIndex.value !== index) return;
        if (crossBudgetDrag) runOnJS(crossBudgetDrag.cancel)();
        dragY.set(withTiming(0, { duration: 140 }, (finished) => {
          if (!finished) return;
          activeIndex.set(-1);
          lifted.set(0);
        }));
      });

    if (scroll?.listRef) {
      pan.blocksExternalGesture(scroll.listRef as never);
    }
    return pan;
  }, [
    activeHeight,
    activeIndex,
    crossBudgetDrag,
    stableExpense,
    finishDrag,
    rowWidth,
    dragY,
    enabled,
    grabY,
    index,
    lifted,
    scroll,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const step = activeHeight.value + ROW_GAP;
    const from = activeIndex.value;
    const current = indexSV.value;
    const isActive = lifted.value === 1;
    let translateY = 0;

    if (from < 0 && !settled.value) {
      origin.set(-1);
      slot.set(current);
      shift.set(0);
      lifted.set(0);
    } else if (settled.value && origin.value >= 0 && step > ROW_GAP) {
      translateY = held.value - (current - origin.value) * step;
    } else if (from >= 0 && step > ROW_GAP) {
      if (origin.value < 0) origin.set(current);
      const target = Math.max(
        0,
        Math.min(count - 1, from + Math.round(dragY.value / step))
      );
      if (current === from) {
        translateY = dragY.value;
        held.set(translateY);
      } else {
        let nextSlot = current;
        if (from < target && current > from && current <= target) {
          nextSlot = current - 1;
          translateY = -step;
        } else if (from > target && current < from && current >= target) {
          nextSlot = current + 1;
          translateY = step;
        }
        held.set(translateY);
        if (slot.value !== nextSlot) {
          slot.set(nextSlot);
          shift.set(withTiming(translateY, { duration: 150 }));
        }
        translateY = shift.value;
      }
    }

    return {
      transform: [{ translateY }],
      opacity: isActive && hasCrossBudgetDrag ? 0 : 1,
      zIndex: isActive ? 20 : 0,
      backgroundColor: isActive ? dragColor : cardColor,
      borderColor: isActive ? accentColor : "transparent",
      borderWidth: 2,
      borderRadius: 8,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          { marginBottom: index === count - 1 ? 0 : ROW_GAP },
          animatedStyle,
        ]}
        onLayout={(event) => {
          rowWidth.set(event.nativeEvent.layout.width);
          const height = event.nativeEvent.layout.height;
          if (height > 0) activeHeight.set(height);
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
