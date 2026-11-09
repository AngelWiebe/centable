import { MaterialIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { StoredBudget } from "../types/budget";
import { currencySettings } from "../types/settings";
import { BudgetScrollContext } from "./BudgetScrollContext";

type BudgetBill = StoredBudget["bills"][number];
type SharedNumber = ReturnType<typeof useSharedValue<number>>;

const ROW_GAP = 16;

function DraggableExpenseRow({
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
  const scrollRef = useContext(BudgetScrollContext);
  const held = useSharedValue(0);
  const origin = useSharedValue(-1);
  const lifted = useSharedValue(0);
  const slot = useSharedValue(index);
  const shift = useSharedValue(0);
  const indexSV = useSharedValue(index);
  // Update before paint so the release offset shrinks by the same amount
  // the row's layout slot moves.
  useLayoutEffect(() => {
    indexSV.value = index;
  }, [index, indexSV]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activateAfterLongPress(220)
      .shouldCancelWhenOutside(false)
      .onStart(() => {
        dragY.value = 0;
        activeIndex.value = index;
        lifted.value = 1;
      })
      .onUpdate((event) => {
        dragY.value = event.translationY;
      })
      .onEnd((event) => {
        const step = activeHeight.value + ROW_GAP;
        const from = index;
        if (step <= ROW_GAP) {
          dragY.value = 0;
          activeIndex.value = -1;
          lifted.value = 0;
          return;
        }
        const to = Math.max(
          0,
          Math.min(count - 1, from + Math.round(event.translationY / step))
        );
        const delta = (to - from) * step;
        dragY.value = withTiming(delta, { duration: 140 }, (finished) => {
          if (!finished) return;
          if (from === to) {
            activeIndex.value = -1;
            lifted.value = 0;
            return;
          }
          held.value = delta;
          settled.value = 1;
          runOnJS(onReorder)(from, to);
        });
      });

    if (scrollRef) {
      pan.blocksExternalGesture(scrollRef as never);
    }
    return pan;
  }, [
    activeHeight,
    activeIndex,
    count,
    dragY,
    enabled,
    held,
    index,
    lifted,
    onReorder,
    scrollRef,
    settled,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const step = activeHeight.value + ROW_GAP;
    const from = activeIndex.value;
    const current = indexSV.value;
    const isActive = lifted.value === 1;
    let translateY = 0;

    if (from < 0 && !settled.value) {
      origin.value = -1;
      slot.value = current;
      lifted.value = 0;
    } else if (settled.value && origin.value >= 0 && step > ROW_GAP) {
      translateY = held.value - (current - origin.value) * step;
    } else if (from >= 0 && step > ROW_GAP) {
      if (origin.value < 0) origin.value = current;
      const target = Math.max(
        0,
        Math.min(count - 1, from + Math.round(dragY.value / step))
      );
      let nextSlot = current;
      if (current === from) {
        translateY = dragY.value;
      } else if (from < target && current > from && current <= target) {
        nextSlot = current - 1;
        translateY = -step;
      } else if (from > target && current < from && current >= target) {
        nextSlot = current + 1;
        translateY = step;
      }
      held.value = translateY;
      if (current === from) {
        slot.value = nextSlot;
        shift.value = translateY;
      } else if (slot.value !== nextSlot) {
        slot.value = nextSlot;
        shift.value = withTiming(translateY, { duration: 150 });
      }
      translateY = shift.value;
    }

    return {
      transform: [{ translateY }],
      zIndex: isActive ? 20 : 0,
      elevation: isActive ? 6 : 0,
      backgroundColor: isActive ? dragColor : cardColor,
      borderColor: isActive ? accentColor : "transparent",
      borderWidth: 2,
      borderRadius: 8,
      marginBottom: current === count - 1 ? 0 : ROW_GAP,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={animatedStyle}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) activeHeight.value = height;
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

interface BudgetItemProps {
  budget: StoredBudget;
}

const BudgetItem: React.FC<BudgetItemProps> = ({ budget }) => {
  const {
    deleteExpenseFromBudget,
    updateExpenseOrder,
    updateExpenseAmount,
    updateIncomeAmount,
    settings,
    toggleExpensePaid,
  } = useBudgetStore();
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];
  const { symbol, decimals } = currencySettings[settings?.currency || "CAD"];

  const [editingIncome, setEditingIncome] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const incomeInputRef = useRef<TextInputInstance>(null);

  const bills = useMemo(() => budget.bills, [budget.bills]);

  const announceChange = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  };

  const handleEditIncome = () => {
    setEditingIncome(true);
    setEditedAmount(budget.income.amount.toFixed(decimals));
    setTimeout(() => incomeInputRef.current?.focus(), 100);
  };

  const saveIncome = () => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        updateIncomeAmount(budget.id, parsedAmount);
        announceChange(
          `Income updated to ${symbol}${parsedAmount.toFixed(decimals)}`
        );
      }
    }
    setEditingIncome(false);
    setEditedAmount(null);
  };

  const handleEditExpense = (rowId: string, amount: number) => {
    setEditingExpenseId(rowId);
    setEditedAmount(amount.toFixed(decimals));
  };

  const saveExpense = (rowId: string) => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        updateExpenseAmount(budget.id, rowId, parsedAmount);
        announceChange(
          `Expense updated to ${symbol}${parsedAmount.toFixed(decimals)}`
        );
      }
    }
    setEditingExpenseId(null);
    setEditedAmount(null);
  };

  const confirmDelete = (rowId: string, name: string) => {
    Alert.alert(
      "Confirm Delete",
      `Delete expense: ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteExpenseFromBudget(budget.id, rowId);
            announceChange(`Deleted expense ${name}`);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const reorderExpenses = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = [...bills];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      updateExpenseOrder(budget.id, next);
      announceChange("Expenses reordered successfully.");
    },
    [bills, budget.id, updateExpenseOrder]
  );

  const dragY = useSharedValue(0);
  const activeIndex = useSharedValue(-1);
  const activeHeight = useSharedValue(0);
  const settled = useSharedValue(0);

  useEffect(() => {
    if (!settled.value) return;
    const frame = requestAnimationFrame(() => {
      settled.value = 0;
      activeIndex.value = -1;
      dragY.value = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, bills, dragY, settled]);

  const validateDecimalInput = (text: string): string => {
    const sanitizedText = text.replace(/[^0-9.]/g, "");
    const parts = sanitizedText.split(".");

    if (parts.length > 2) return parts[0] + "." + parts[1];
    if (parts[1]?.length > 2) return parts[0] + "." + parts[1].substring(0, 2);

    return sanitizedText;
  };

  const renderBill = (item: BudgetBill, index: number) => {
    const { id: rowId, expense, paid, amount } = item;

    const togglePaid = () => {
      toggleExpensePaid(budget.id, rowId, !paid);
      announceChange(
        `Expense ${expense.name} marked as ${
          paid ? "unpaid" : "paid"
        } successfully.`
      );
    };

    return (
      <DraggableExpenseRow
        key={rowId}
        index={index}
        count={bills.length}
        dragY={dragY}
        activeIndex={activeIndex}
        activeHeight={activeHeight}
        onReorder={reorderExpenses}
        cardColor={colorScheme.cardBackground}
        dragColor={colorScheme.draggingRow}
        accentColor={colorScheme.tabIconSelected}
        enabled={editingExpenseId !== rowId}
        settled={settled}
      >
        <View
          style={styles.expenseRow}
          accessible={true}
          accessibilityLabel={`Expense item: ${
            expense.name
          }, amount ${expense.amount.toFixed(2)}, ${paid ? "paid" : "not paid"}`}
          accessibilityRole="adjustable"
        >
        <View style={styles.deleteWrapper}>
          <TouchableOpacity
            onPress={() => confirmDelete(rowId, expense.name)}
            accessible={true}
            accessibilityLabel={`Delete ${expense.name}`}
          >
            <MaterialIcons name="delete" size={24} color={colorScheme.icon} />
          </TouchableOpacity>
        </View>
        <View
          style={styles.expenseItem}
          accessible={true}
          accessibilityLabel={`Drag handle for ${expense.name}`}
          accessibilityHint="Long press and drag to reorder expenses"
        >
          <View style={styles.expenseLeft}>
            <Text
              style={[
                styles.expenseName,
                {
                  color: colorScheme.text,
                },
              ]}
            >
              {expense.name}
            </Text>
            <Text
              style={[
                styles.expenseDate,
                {
                  color: colorScheme.text,
                },
              ]}
            >
              {new Date(expense.date).toDateString()}
            </Text>
          </View>

          {editingExpenseId === rowId ? (
            <TextInput
              placeholder="Enter amount"
              style={[
                styles.expenseInput,
                {
                  backgroundColor: colorScheme.pickerBackground,
                  color: colorScheme.text,
                },
              ]}
              placeholderTextColor={colorScheme.buttonBorder}
              keyboardType="decimal-pad"
              value={editedAmount || ""}
              onChangeText={(text) =>
                setEditedAmount(validateDecimalInput(text))
              }
              onSubmitEditing={() => saveExpense(rowId)}
              onBlur={() => saveExpense(rowId)}
              accessibilityLabel={`Edit expense amount for ${expense.name}`}
              maxLength={15}
            />
          ) : (
            <TouchableOpacity
              onPress={() => handleEditExpense(rowId, amount)}
              accessible={true}
              accessibilityLabel={`Expense amount ${symbol}${expense.amount.toFixed(
                decimals
              )}, tap to edit`}
            >
              <Text
                style={[
                  styles.expenseAmount,
                  {
                    color: colorScheme.text,
                  },
                ]}
              >
                {symbol}
                {amount.toFixed(decimals)}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={togglePaid}>
            <MaterialIcons
              name={paid ? "check-circle" : "radio-button-unchecked"}
              size={24}
              color={paid ? "#00FF7F" : "#AAAAAA"}
              style={styles.paidIcon}
            />
          </TouchableOpacity>
        </View>
        </View>
      </DraggableExpenseRow>
    );
  };

  const totalExpenses = bills.reduce((sum, { amount }) => sum + amount, 0);
  // Use budget.remainingBalance which is already calculated and stored in the database
  // Fallback to calculated value if not available
  const remainingBalance =
    budget.remainingBalance ?? budget.amount - totalExpenses;

  return (
    <View
      style={[
        styles.budgetContainer,
        { backgroundColor: colorScheme.background },
      ]}
    >
      <View style={styles.budgetHeader}>
        <Text style={[styles.budgetTitle, { color: colorScheme.text }]}>
          Budget for {new Date(budget.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.incomeRow}>
        <Text
          style={[
            styles.label,
            {
              color: colorScheme.text,
            },
          ]}
        >
          {budget.income.name}:
        </Text>
        {editingIncome ? (
          <TextInput
            ref={incomeInputRef}
            placeholder="Enter amount"
            style={[styles.incomeInput, { color: colorScheme.text }]}
            keyboardType="decimal-pad"
            value={editedAmount || ""}
            onChangeText={(text) => setEditedAmount(validateDecimalInput(text))}
            onSubmitEditing={saveIncome}
            onBlur={saveIncome}
          />
        ) : (
          <TouchableOpacity onPress={handleEditIncome}>
            <Text
              style={[
                styles.incomeAmount,
                { color: colorScheme.summaryAmount },
              ]}
            >
              {symbol}
              {budget.income.amount.toFixed(decimals)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.expenseList}>
        {bills.map((item, index) => renderBill(item, index))}
      </View>

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, { color: colorScheme.text }]}>
          Remaining Balance:
        </Text>
        <Text
          style={[
            styles.summaryAmount,
            {
              color:
                remainingBalance < 0
                  ? colorScheme.negativeBalance
                  : colorScheme.summaryAmount,
            },
          ]}
        >
          {symbol}
          {remainingBalance.toFixed(decimals)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  budgetContainer: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  billItem: {
    padding: 10,
    borderWidth: 1,
    marginBottom: 5,
    borderColor: "#ccc",
    borderRadius: 5,
  },
  incomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
  },
  deleteWrapper: {
    justifyContent: "center",
    margin: 5,
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  incomeInput: {
    fontSize: 16,
    padding: 0,
  },
  expenseRow: {
    flexDirection: "row",
    padding: 10,
    paddingLeft: 0,
    borderRadius: 8,
  },
  expenseList: {
    overflow: "visible",
  },
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  expenseLeft: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
  },
  expenseDate: {
    fontSize: 14,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  expenseInput: {
    fontSize: 16,
    borderRadius: 5,
    padding: 8,
  },
  paidIcon: {
    marginLeft: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  negativeBalance: {
    color: "#FF6347",
  },
});

export default BudgetItem;
