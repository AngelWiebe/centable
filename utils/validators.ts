import { IncomeInterface } from "../types/income";
import { ExpenseInterface } from "../types/expense";
import { StoredBudget } from "../types/budget";

export const isValidIncome = (income: any): income is IncomeInterface => {
  return (
    income &&
    typeof income.id === "string" &&
    typeof income.name === "string" &&
    typeof income.amount === "number" &&
    typeof income.date === "string" &&
    income.frequency &&
    typeof income.frequency.value === "number" &&
    typeof income.frequency.unit === "string"
  );
};

export const isValidExpense = (expense: any): expense is ExpenseInterface => {
  return (
    expense &&
    typeof expense.id === "string" &&
    typeof expense.name === "string" &&
    typeof expense.amount === "number" &&
    typeof expense.date === "string" &&
    expense.frequency &&
    typeof expense.frequency.value === "number" &&
    typeof expense.frequency.unit === "string"
  );
};

export const isValidBudget = (budget: any): budget is StoredBudget => {
  return (
    budget &&
    typeof budget.date === "string" &&
    Array.isArray(budget.bills) &&
    Array.isArray(budget.incomes)
  );
};

export const filterValidItems = <T>(
  items: any[],
  validator: (item: any) => item is T
): T[] => {
  return items.filter(validator);
};
