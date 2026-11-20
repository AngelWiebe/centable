import { useShallow } from "zustand/react/shallow";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { currencySettings } from "../types/settings";
import { toLocalDay } from "../utils/occurrenceDates";

export default function UnfundedExpenses() {
  const { unfundedExpenses, selectedMonth, selectedYear, settings } = useBudgetStore(
    useShallow(state => ({
      unfundedExpenses: state.unfundedExpenses,
      selectedMonth: state.selectedMonth,
      selectedYear: state.selectedYear,
      settings: state.settings,
    }))
  );
  const colors = settings?.theme === "dark" ? Colors.dark : Colors.light;
  const { symbol, decimals } = currencySettings[settings?.currency ?? "CAD"];
  const items = unfundedExpenses.filter(item => {
    const date = toLocalDay(item.expense.date);
    return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
  });
  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.negativeBalance }]}>
        Unfunded expenses
      </Text>
      <Text style={{ color: colors.text }}>
        No earlier income can cover each of these expenses in full.
      </Text>
      {items.map(item => (
        <View key={item.id} style={[styles.item, { borderColor: colors.borderBottomColor }]}>
          <Text style={[styles.heading, { color: colors.text }]}>{item.expense.name}</Text>
          <Text style={{ color: colors.text }}>
            {toLocalDay(item.expense.date).toLocaleDateString()} · {symbol}{item.amount.toFixed(decimals)}
          </Text>
          <Text style={{ color: colors.negativeBalance }}>
            Needs {symbol}{item.shortfall.toFixed(decimals)} more in one earlier budget.
          </Text>
          {item.paid && <Text style={{ color: colors.text }}>Marked paid · no budget assigned</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, marginBottom: 16, borderRadius: 8 },
  heading: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  item: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
});
