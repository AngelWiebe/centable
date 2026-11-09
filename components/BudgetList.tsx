import React, { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import {
  FlatList,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { StoredBudget } from "../types/budget";
import BudgetItem from "./BudgetItem";
import { BudgetScrollContext } from "./BudgetScrollContext";

const BudgetList: React.FC<{}> = ({}) => {
  const { budgets, selectedMonth, selectedYear, settings } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const filteredBudgets = useMemo(() => {
    const filtered = budgets
      .filter((budget: StoredBudget) => {
        const budgetDate = new Date(budget.date);

        return (
          budgetDate.getMonth() + 1 === selectedMonth &&
          budgetDate.getFullYear() === selectedYear
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return filtered;
  }, [budgets, selectedMonth, selectedYear]);

  useEffect(() => {
    if (filteredBudgets.length === 0) {
      AccessibilityInfo.announceForAccessibility(
        "No budgets found for the selected month and year."
      );
    } else {
      AccessibilityInfo.announceForAccessibility(
        `${filteredBudgets.length} budgets found for the selected month and year.`
      );
    }
  }, [filteredBudgets]);

  const listRef = useRef(null);
  const renderItem = ({ item }: { item: StoredBudget }) => (
    <BudgetItem budget={item} />
  );

  if (filteredBudgets.length === 0) {
    return (
      <View
        style={[
          styles.noBudgetsContainer,
          { backgroundColor: colorScheme.cardBackground },
        ]}
        accessible={true}
        accessibilityLiveRegion="polite"
        accessibilityLabel="No budgets available"
      >
        <Text style={[styles.noBudgetsText, { color: colorScheme.text }]}>
          No budgets found for the selected month and year.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <BudgetScrollContext.Provider value={listRef}>
        <FlatList
          ref={listRef}
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ flex: 1 }}
          data={filteredBudgets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          accessible={true}
          accessibilityRole="list"
          accessibilityLabel="Filtered budget list"
        />
      </BudgetScrollContext.Provider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noBudgetsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noBudgetsText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});

export default BudgetList;
