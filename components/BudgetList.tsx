import React, { useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  AccessibilityInfo,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { StoredBudget } from "../types/budget";
import useBudgetStore from "../app/store/useBudgetStore";
import BudgetItem from "./BudgetItem";

const BudgetList: React.FC<{}> = ({}) => {
  const { budgets, selectedMonth, selectedYear } = useBudgetStore();

  const filteredBudgets = useMemo(() => {
    const filtered = budgets.filter((budget: StoredBudget) => {
      const budgetDate = new Date(budget.date);

      return (
        budgetDate.getMonth() + 1 === selectedMonth &&
        budgetDate.getFullYear() === selectedYear
      );
    });

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

  const renderItem = ({ item }: { item: StoredBudget }) => (
    <BudgetItem key={item.id} budget={item} />
  );

  if (filteredBudgets.length === 0) {
    return (
      <View
        style={styles.noBudgetsContainer}
        accessible={true}
        accessibilityLiveRegion="polite"
        accessibilityLabel="No budgets available"
      >
        <Text style={styles.noBudgetsText}>
          No budgets found for the selected month and year.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <FlatList
        data={filteredBudgets}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        accessible={true}
        accessibilityRole="list"
        accessibilityLabel="Filtered budget list"
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 10,
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
    color: "gray",
    textAlign: "center",
  },
});

export default BudgetList;
