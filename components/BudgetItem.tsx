import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";

import useBudgetStore from "../app/store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { StoredBudget } from "../types/budget";

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

  const [editingIncome, setEditingIncome] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const incomeInputRef = useRef<TextInput>(null);

  const bills = useMemo(() => budget.bills, [budget.bills]);

  const announceChange = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  };

  const handleEditIncome = () => {
    setEditingIncome(true);
    setEditedAmount(budget.income.amount.toFixed(2));
    setTimeout(() => incomeInputRef.current?.focus(), 100);
  };

  const saveIncome = () => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        updateIncomeAmount(budget.id, parsedAmount);
        announceChange(`Income updated to ${parsedAmount.toFixed(2)}`);
      }
    }
    setEditingIncome(false);
    setEditedAmount(null);
  };

  const handleEditExpense = (rowId: string, amount: number) => {
    setEditingExpenseId(rowId);
    setEditedAmount(amount.toFixed(2));
  };

  const saveExpense = (rowId: string) => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        updateExpenseAmount(budget.id, rowId, parsedAmount);
        announceChange(`Expense updated to ${parsedAmount.toFixed(2)}`);
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

  const handleDragEnd = ({ data }: { data: any[] }) => {
    updateExpenseOrder(budget.id, data);
    announceChange("Expenses reordered successfully.");
  };

  const validateDecimalInput = (text: string): string => {
    const sanitizedText = text.replace(/[^0-9.]/g, "");
    const parts = sanitizedText.split(".");

    if (parts.length > 2) return parts[0] + "." + parts[1];
    if (parts[1]?.length > 2) return parts[0] + "." + parts[1].substring(0, 2);

    return sanitizedText;
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: {
    item: { id: string; expense: any; paid: boolean; amount: number };
    drag: () => void;
    isActive: boolean;
  }) => {
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
      <View
        key={rowId}
        style={[
          styles.expenseRow,
          isActive && styles.draggingRow,
          { backgroundColor: colorScheme.cardBackground },
        ]}
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
        <TouchableOpacity
          onLongPress={drag}
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
              placeholderTextColor={colorScheme.buttonText}
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
              accessibilityLabel={`Expense amount ${expense.amount.toFixed(
                2
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
                ${amount.toFixed(2)}
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
        </TouchableOpacity>
      </View>
    );
  };

  const totalExpenses = bills.reduce((sum, { amount }) => sum + amount, 0);
  // Use budget.remainingBalance which is already calculated and stored in the database
  // Fallback to calculated value if not available
  const remainingBalance = budget.remainingBalance ?? (budget.amount - totalExpenses);

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
              ${budget.income.amount.toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <DraggableFlatList
        data={bills}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
        renderItem={renderItem}
      />

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
          ${remainingBalance.toFixed(2)}
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
    marginBottom: 8,
    borderRadius: 8,
  },
  draggingRow: {
    backgroundColor: "#4A90E2",
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
