import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  AccessibilityInfo,
} from "react-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { MaterialIcons } from "@expo/vector-icons";

import { StoredBudget } from "../types/budget";
import useBudgetStore from "../app/store/useBudgetStore";

interface BudgetItemProps {
  budget: StoredBudget;
}

const BudgetItem: React.FC<BudgetItemProps> = ({ budget }) => {
  const {
    updateExpenseOrder,
    updateExpenseAmount,
    updateIncomeAmount,
    toggleExpensePaid,
  } = useBudgetStore();

  const [editingIncome, setEditingIncome] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const incomeInputRef = useRef<TextInput>(null);

  const bills = useMemo(() => budget.bills, [budget.bills]);

  console.log("bills", bills);

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

  const handleEditExpense = (expenseId: string, amount: number) => {
    setEditingExpenseId(expenseId);
    setEditedAmount(amount.toFixed(2));
  };

  const saveExpense = (expenseId: string) => {
    if (editedAmount !== null) {
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        updateExpenseAmount(budget.id, expenseId, parsedAmount);
        announceChange(`Expense updated to ${parsedAmount.toFixed(2)}`);
      }
    }
    setEditingExpenseId(null);
    setEditedAmount(null);
  };

  const handleDragEnd = ({ data }: { data: any[] }) => {
    updateExpenseOrder(
      budget.id,
      data.map((bill) => bill.expense)
    );
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
    item: { expense: any; paid: boolean };
    drag: () => void;
    isActive: boolean;
  }) => {
    const { expense, paid } = item;

    const togglePaid = () => {
      toggleExpensePaid(budget.id, expense.id);
      announceChange(
        `Expense ${expense.name} marked as ${
          paid ? "unpaid" : "paid"
        } successfully.`
      );
    };

    return (
      <View
        key={expense.id}
        style={[styles.expenseRow, isActive && styles.draggingRow]}
        accessible={true}
        accessibilityLabel={`Expense item: ${
          expense.name
        }, amount ${expense.amount.toFixed(2)}, ${paid ? "paid" : "not paid"}`}
        accessibilityRole="adjustable"
      >
        <TouchableOpacity
          onLongPress={drag}
          style={styles.expenseItem}
          accessible={true}
          accessibilityLabel={`Drag handle for ${expense.name}`}
          accessibilityHint="Long press and drag to reorder expenses"
        >
          <View style={styles.expenseLeft}>
            <Text style={styles.expenseName}>{expense.name}</Text>
            <Text style={styles.expenseDate}>
              {new Date(expense.date).toDateString()}
            </Text>
          </View>

          {editingExpenseId === expense.id ? (
            <TextInput
              placeholder="Enter amount"
              style={styles.expenseInput}
              placeholderTextColor="#CCCCCC"
              keyboardType="decimal-pad"
              value={editedAmount || ""}
              onChangeText={(text) =>
                setEditedAmount(validateDecimalInput(text))
              }
              onSubmitEditing={() => saveExpense(expense.id)}
              onBlur={() => saveExpense(expense.id)}
              accessibilityLabel={`Edit expense amount for ${expense.name}`}
              maxLength={15}
            />
          ) : (
            <TouchableOpacity
              onPress={() => handleEditExpense(expense.id, expense.amount)}
              accessible={true}
              accessibilityLabel={`Expense amount ${expense.amount.toFixed(
                2
              )}, tap to edit`}
            >
              <Text style={styles.expenseAmount}>
                ${expense.amount.toFixed(2)}
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

  const totalExpenses = bills.reduce(
    (sum, { expense }) => sum + expense.amount,
    0
  );
  const remainingBalance = budget.income.amount - totalExpenses;

  return (
    <View style={styles.budgetContainer}>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetTitle}>
          Budget for {new Date(budget.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.incomeRow}>
        <Text style={styles.label}>{budget.income.name}:</Text>
        {editingIncome ? (
          <TextInput
            ref={incomeInputRef}
            placeholder="Enter amount"
            style={styles.incomeInput}
            keyboardType="decimal-pad"
            value={editedAmount || ""}
            onChangeText={(text) => setEditedAmount(validateDecimalInput(text))}
            onSubmitEditing={saveIncome}
            onBlur={saveIncome}
          />
        ) : (
          <TouchableOpacity onPress={handleEditIncome}>
            <Text style={styles.incomeAmount}>
              ${budget.income.amount.toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <DraggableFlatList
        data={bills}
        keyExtractor={(item) => item.expense.id}
        onDragEnd={handleDragEnd}
        renderItem={renderItem}
      />

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Remaining Balance:</Text>
        <Text
          style={[
            styles.summaryAmount,
            remainingBalance < 0 && styles.negativeBalance,
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
    backgroundColor: "#1E1E1E",
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
    color: "#FFFFFF",
  },
  incomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: "#AAAAAA",
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF7F",
  },
  incomeInput: {
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "#2E2E2E",
    padding: 8,
  },
  expenseRow: {
    flexDirection: "row",
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "#2E2E2E",
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
    color: "#FFFFFF",
  },
  expenseDate: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFA500",
  },
  expenseInput: {
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "#333333",
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
    color: "#FFFFFF",
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF7F",
  },
  negativeBalance: {
    color: "#FF6347",
  },
});

export default BudgetItem;
