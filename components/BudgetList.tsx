import { useShallow } from "zustand/react/shallow";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import {
  FlatList,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { budgetMatchesMonth } from "../utils/buildBudgets";
import { StoredBudget } from "../types/budget";
import BudgetItem from "./BudgetItem";
import UnfundedExpenses from "./UnfundedExpenses";
import { BudgetDragProvider, BudgetDropTarget, BudgetDragListContext } from "./BudgetDragContext";
import { BudgetScrollContext } from "./BudgetScrollContext";

function BudgetListContent({ listRef }: { listRef: React.RefObject<React.ComponentRef<typeof FlatList<StoredBudget>> | null> }) {
  const dragEvents = useContext(BudgetDragListContext)!;
  const { budgets, selectedMonth, selectedYear, settings, loadError } = useBudgetStore(
    useShallow(state => ({
      budgets: state.budgets,
      selectedMonth: state.selectedMonth,
      selectedYear: state.selectedYear,
      settings: state.settings,
      loadError: state.loadError,
    }))
  );
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const filteredBudgets = useMemo(() => {
    const filtered = budgets
      .filter((budget: StoredBudget) => budgetMatchesMonth(budget, selectedMonth, selectedYear))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return filtered;
  }, [budgets, selectedMonth, selectedYear]);

  useEffect(() => {
    if (loadError) {
      AccessibilityInfo.announceForAccessibility(loadError);
    } else if (filteredBudgets.length === 0) {
      AccessibilityInfo.announceForAccessibility(
        "No budgets found for the selected month and year."
      );
    } else {
      AccessibilityInfo.announceForAccessibility(
        `${filteredBudgets.length} budgets found for the selected month and year.`
      );
    }
  }, [filteredBudgets, loadError]);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scroll = useMemo(
    () => ({ listRef, setScrollEnabled }),
    [listRef]
  );
  const renderItem = ({ item }: { item: StoredBudget }) => (
    <BudgetDropTarget budgetId={item.id}><BudgetItem budget={item} /></BudgetDropTarget>
  );

  const emptyList = (
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

  return (
      <BudgetScrollContext.Provider value={scroll}>
        <FlatList
          ref={listRef}
          onScroll={dragEvents.onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={dragEvents.onContentSizeChange}
          removeClippedSubviews={false}
          // Keep this month's cards mounted so a dragged row survives edge scrolling.
          initialNumToRender={filteredBudgets.length}
          maxToRenderPerBatch={Math.max(10, filteredBudgets.length)}
          windowSize={Math.max(21, filteredBudgets.length * 5)}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ flex: 1 }}
          ListHeaderComponent={<>
            {loadError && <Text accessibilityRole="alert" style={{ color: colorScheme.negativeBalance, padding: 16 }}>{loadError}</Text>}
            {filteredBudgets.length > 0 && <Text style={{ color: colorScheme.text, paddingBottom: 12 }}>Hold an expense to drag it, or use its options button to reorder or move it.</Text>}
            <UnfundedExpenses />
          </>}
          ListEmptyComponent={loadError ? undefined : emptyList}
          data={filteredBudgets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          accessible={false}
          accessibilityRole="list"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        />
      </BudgetScrollContext.Provider>
  );
};

function BudgetList() {
  const listRef = useRef<React.ComponentRef<typeof FlatList<StoredBudget>>>(null);
  return <GestureHandlerRootView style={styles.container}>
    <BudgetDragProvider listRef={listRef}>
      <BudgetListContent listRef={listRef} />
    </BudgetDragProvider>
  </GestureHandlerRootView>;
}

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
