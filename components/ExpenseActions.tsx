import React, { useRef, useState } from "react";
import { AccessibilityInfo, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { Colors } from "../constants/Colors";
import useBudgetStore from "../store/useBudgetStore";
import { budgetMatchesMonth } from "../utils/buildBudgets";
import { currencySettings } from "../types/settings";
import type { StoredBudget } from "../types/budget";

/** The same operations as dragging, available through ordinary taps or a screen reader. */
export default function ExpenseActions({ budgetId, bill, index, count, onReorder }: {
  budgetId: string;
  bill: StoredBudget["bills"][number];
  index: number;
  count: number;
  onReorder: (from: number, to: number) => Promise<boolean>;
}) {
  const { budgets, selectedMonth, selectedYear, settings } = useBudgetStore(useShallow(state => ({
    budgets: state.budgets, selectedMonth: state.selectedMonth, selectedYear: state.selectedYear, settings: state.settings,
  })));
  const colors = Colors[settings?.theme ?? "dark"];
  const { symbol, decimals } = currencySettings[settings?.currency ?? "CAD"];
  const [open, setOpen] = useState(false);
  const [choosingBudget, setChoosingBudget] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const destinations = budgets.filter(budget => budget.id !== budgetId && budgetMatchesMonth(budget, selectedMonth, selectedYear))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const close = () => { if (!lock.current) { setOpen(false); setChoosingBudget(false); } };
  const reorder = async (to: number) => {
    if (lock.current || to < 0 || to >= count) return;
    lock.current = true; setSaving(true);
    try { if (await onReorder(index, to)) { setOpen(false); setChoosingBudget(false); } }
    finally { lock.current = false; setSaving(false); }
  };
  const move = async (destinationId: string) => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try {
      const state = useBudgetStore.getState();
      const current = state.budgets.find(budget => budget.id === budgetId)?.bills.find(item => item.id === bill.id);
      if (!current) throw new Error("Expense occurrence not found");
      await state.moveExpenseBetweenBudgets(budgetId, destinationId, current.expense.id, current.id, current.amount);
      AccessibilityInfo.announceForAccessibility(`Moved ${current.expense.name} to another budget.`);
      setOpen(false); setChoosingBudget(false);
    } catch {
      Alert.alert("Unable to move expense", "Your previous budgets are unchanged. Please try again.");
    } finally { lock.current = false; setSaving(false); }
  };
  const buttonStyle = [styles.action, { borderColor: colors.buttonBorder }];
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Options for ${bill.expense.name}`}
      accessibilityHint="Reorder this expense or move it to another budget" style={styles.trigger} onPress={() => setOpen(true)}>
      <Text accessible={false} style={{ color: colors.text, fontSize: 24 }}>⋯</Text>
    </TouchableOpacity>
    {open && <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.background }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{choosingBudget ? `Move ${bill.expense.name} to a budget` : `Options for ${bill.expense.name}`}</Text>
          {choosingBudget ? <FlatList data={destinations} keyExtractor={budget => budget.id} renderItem={({ item }) => {
            const label = `${item.income.name}, ${new Date(item.date).toLocaleDateString()}`;
            return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Move ${bill.expense.name} to ${label}`} disabled={saving}
              accessibilityState={{ disabled: saving, busy: saving }} style={buttonStyle} onPress={() => move(item.id)}>
              <Text style={{ color: colors.text }}>{label}</Text>
              <Text style={{ color: colors.text }}>Remaining: {symbol}{item.remainingBalance.toFixed(decimals)}</Text>
            </TouchableOpacity>;
          }} /> : <>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Move ${bill.expense.name} up`} disabled={saving || index === 0}
              accessibilityState={{ disabled: saving || index === 0 }} style={buttonStyle} onPress={() => reorder(index - 1)}>
              <Text style={{ color: colors.text }}>Move up</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Move ${bill.expense.name} down`} disabled={saving || index === count - 1}
              accessibilityState={{ disabled: saving || index === count - 1 }} style={buttonStyle} onPress={() => reorder(index + 1)}>
              <Text style={{ color: colors.text }}>Move down</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Move ${bill.expense.name} to another budget`} disabled={saving || destinations.length === 0}
              accessibilityState={{ disabled: saving || destinations.length === 0 }} style={buttonStyle} onPress={() => setChoosingBudget(true)}>
              <Text style={{ color: colors.text }}>Move to another budget</Text>
            </TouchableOpacity>
            {destinations.length === 0 && <Text style={{ color: colors.text }}>No other budgets in the selected month.</Text>}
          </>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel expense options" disabled={saving}
            accessibilityState={{ disabled: saving }} style={buttonStyle} onPress={close}>
            <Text style={{ color: colors.text }}>{saving ? "Saving…" : "Cancel"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>}
  </>;
}
const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
  dialog: { maxHeight: "80%", padding: 16, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  action: { minHeight: 44, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
