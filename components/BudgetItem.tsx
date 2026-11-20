import { useShallow } from "zustand/react/shallow";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
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
import { useSharedValue } from "react-native-reanimated";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { StoredBudget } from "../types/budget";
import { currencySettings } from "../types/settings";
import ExpenseActions from "./ExpenseActions";
import DraggableExpenseRow from "./DraggableExpenseRow";

type BudgetBill = StoredBudget["bills"][number];
interface BudgetItemProps {
  budget: StoredBudget;
}

const BudgetItem: React.FC<BudgetItemProps> = ({ budget }) => {
  const {
    addExpenseToBudget,
    deleteExpenseFromBudget,
    updateExpenseOrder,
    updateExpenseAmount,
    updateIncomeAmount,
    settings,
    toggleExpensePaid,
  } = useBudgetStore(
    useShallow(state => ({
      addExpenseToBudget: state.addExpenseToBudget,
      deleteExpenseFromBudget: state.deleteExpenseFromBudget,
      updateExpenseOrder: state.updateExpenseOrder,
      updateExpenseAmount: state.updateExpenseAmount,
      updateIncomeAmount: state.updateIncomeAmount,
      settings: state.settings,
      toggleExpensePaid: state.toggleExpensePaid,
    }))
  );
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];
  const { symbol, decimals } = currencySettings[settings?.currency || "CAD"];

  const [editingIncome, setEditingIncome] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState(() => new Date(budget.date));
  const [showDraftDatePicker, setShowDraftDatePicker] = useState(false);
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

  const saveIncome = async () => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        try {
          await updateIncomeAmount(budget.id, parsedAmount);
        } catch {
          Alert.alert("Unable to save income", "Your previous budget is unchanged. Please try again.");
          return;
        }
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

  const saveExpense = async (rowId: string) => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        try {
          await updateExpenseAmount(budget.id, rowId, parsedAmount);
        } catch {
          Alert.alert("Unable to save expense", "Your previous budget is unchanged. Please try again.");
          return;
        }
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
          onPress: async () => {
            try {
              await deleteExpenseFromBudget(budget.id, rowId);
              announceChange(`Deleted expense ${name}`);
            } catch {
              Alert.alert("Unable to delete expense", "Your previous budget is unchanged. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const dragY = useSharedValue(0);
  const activeIndex = useSharedValue(-1);
  const activeHeight = useSharedValue(0);
  const settled = useSharedValue(0);


  const reorderExpenses = useCallback(
    async (from: number, to: number) => {
      if (from === to) return true;
      const next = [...bills];
      const [moved] = next.splice(from, 1);
      if (!moved) return false;
      next.splice(to, 0, moved);
      try {
        await updateExpenseOrder(budget.id, next);
        announceChange("Expenses reordered successfully.");
        return true;
      } catch {
        settled.set(0);
        activeIndex.set(-1);
        dragY.set(0);
        Alert.alert("Unable to save order", "The previous order is unchanged. Please try again.");
        return false;
      }
    },
    [bills, budget.id, updateExpenseOrder, settled, activeIndex, dragY]
  );


  useEffect(() => {
    if (!settled.value) return;
    const frame = requestAnimationFrame(() => {
      settled.set(0);
      activeIndex.set(-1);
      dragY.set(0);
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

    const togglePaid = async () => {
      try {
        await toggleExpensePaid(budget.id, rowId, !paid);
      } catch {
        Alert.alert("Unable to save payment status", "The previous status is unchanged. Please try again.");
        return;
      }
      announceChange(
        `Expense ${expense.name} marked as ${
          paid ? "unpaid" : "paid"
        } successfully.`
      );
    };

    return (
      <DraggableExpenseRow
        key={rowId}
        expense={{ budgetId: budget.id, rowId, name: expense.name, amount }}
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
          accessible={false}
        >
        <View style={styles.deleteWrapper}>
          <TouchableOpacity
            onPress={() => confirmDelete(rowId, expense.name)}
            accessible={true}
            accessibilityLabel={`Delete ${expense.name}`}
            accessibilityRole="button"
            style={styles.iconButton}
          >
            <MaterialIcons name="delete" size={24} color={colorScheme.icon} />
          </TouchableOpacity>
        </View>
        <View
          style={styles.expenseItem}
          accessible={false}
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

          <ExpenseActions budgetId={budget.id} bill={item} index={index} count={bills.length} onReorder={reorderExpenses} />
          <TouchableOpacity onPress={togglePaid} style={styles.iconButton} accessibilityRole="checkbox"
            accessibilityLabel={`Paid status for ${expense.name}`} accessibilityState={{ checked: paid }}>
            <MaterialIcons
              name={paid ? "check-circle" : "radio-button-unchecked"}
              size={24}
              color={paid ? colorScheme.paidIcon : colorScheme.tabIconDefault}
              style={styles.paidIcon}
            />
          </TouchableOpacity>
        </View>
        </View>
      </DraggableExpenseRow>
    );
  };

  const openAddExpense = () => {
    setDraftTitle("");
    setDraftAmount("");
    setDraftDate(new Date(budget.date));
    setShowDraftDatePicker(false);
    setAddingExpense(true);
  };

  const saveAddedExpense = async () => {
    const title = draftTitle.trim();
    const amount = parseFloat(draftAmount);
    if (!title || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Add expense", "Enter a title, an amount, and a date.");
      return;
    }
    try {
      await addExpenseToBudget(budget.id, { name: title, amount, date: draftDate });
    } catch {
      Alert.alert("Unable to add expense", "Your previous budget is unchanged. Please try again.");
      return;
    }
    announceChange(`Added ${title} to this budget.`);
    setAddingExpense(false);
    setShowDraftDatePicker(false);
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
            accessibilityLabel={`Income amount for ${budget.income.name}`}
            placeholder="Enter amount"
            style={[styles.incomeInput, { color: colorScheme.text }]}
            keyboardType="decimal-pad"
            value={editedAmount || ""}
            onChangeText={(text) => setEditedAmount(validateDecimalInput(text))}
            onSubmitEditing={saveIncome}
            onBlur={saveIncome}
          />
        ) : (
          <TouchableOpacity onPress={handleEditIncome} accessibilityRole="button"
            accessibilityLabel={`Income amount for ${budget.income.name}, tap to edit`}>
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

      {addingExpense ? (
        <View style={styles.addExpenseForm}>
          <TextInput
            placeholder="Title"
            value={draftTitle}
            onChangeText={setDraftTitle}
            style={[
              styles.addExpenseInput,
              {
                backgroundColor: colorScheme.cardBackground,
                color: colorScheme.text,
                borderColor: colorScheme.borderBottomColor,
              },
            ]}
            placeholderTextColor={colorScheme.buttonBorder}
            accessibilityLabel="Expense title"
          />
          <TextInput
            placeholder="Amount"
            value={draftAmount}
            onChangeText={(text) => setDraftAmount(validateDecimalInput(text))}
            keyboardType="decimal-pad"
            style={[
              styles.addExpenseInput,
              {
                backgroundColor: colorScheme.cardBackground,
                color: colorScheme.text,
                borderColor: colorScheme.borderBottomColor,
              },
            ]}
            placeholderTextColor={colorScheme.buttonBorder}
            accessibilityLabel="Expense amount"
          />
          <TouchableOpacity
            onPress={() => setShowDraftDatePicker(true)}
            style={[
              styles.addExpenseInput,
              {
                backgroundColor: colorScheme.cardBackground,
                borderColor: colorScheme.borderBottomColor,
              },
            ]}
            accessibilityLabel="Expense date"
          >
            <Text style={{ color: colorScheme.text }}>
              {draftDate.toDateString()}
            </Text>
          </TouchableOpacity>
          {showDraftDatePicker && (
            <DateTimePicker
              value={draftDate}
              mode="date"
              onChange={(event, date) => {
                if (event.type === "set" && date) setDraftDate(date);
                setShowDraftDatePicker(false);
              }}
            />
          )}
          <View style={styles.addExpenseActions}>
            <TouchableOpacity
              onPress={() => {
                setAddingExpense(false);
                setShowDraftDatePicker(false);
              }}
              accessibilityLabel="Cancel adding expense"
            >
              <Text style={[styles.addExpenseCancel, { color: colorScheme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveAddedExpense}
              style={[
                styles.addExpenseSave,
                { backgroundColor: colorScheme.submitButton },
              ]}
              accessibilityLabel="Save expense on this budget"
            >
              <Text style={{ color: colorScheme.buttonText }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={openAddExpense}
          style={styles.addExpenseButton}
          accessibilityLabel="Add an expense to this budget"
        >
          <MaterialIcons name="add" size={20} color={colorScheme.tabIconSelected} />
          <Text style={[styles.addExpenseLabel, { color: colorScheme.tabIconSelected }]}>
            Add expense
          </Text>
        </TouchableOpacity>
      )}

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
  iconButton: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
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
  addExpenseButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  addExpenseLabel: {
    fontSize: 16,
    marginLeft: 4,
  },
  addExpenseForm: {
    marginBottom: 16,
  },
  addExpenseInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  addExpenseActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  addExpenseCancel: {
    fontSize: 16,
    marginRight: 16,
  },
  addExpenseSave: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
