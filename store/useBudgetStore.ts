import { Platform } from "react-native";
import uuid from "react-native-uuid";
import { create } from "zustand";

import {
  addOrUpdateBudget,
  addOrUpdateExpense,
  addOrUpdateIncome,
  clearAllBudgets,
  deleteBudget,
  deleteExpense,
  deleteExpenseFromBudgetInDB,
  deleteIncome,
  dismissBudgetExpense,
  getBudgets,
  getDismissedBudgetExpenseKeys,
  getExpenses,
  getIncomes,
  getPaidStatusFromDB,
  getSettings,
  moveExpenseBetweenBudgetsInDB,
  setPaidStatusInDB,
  setupDatabase,
  updateCurrency,
  updateExpenseAmountInDB,
  updateExpenseOrderInDB,
  updateIncomeAmountInDB,
  updateTheme,
} from "../database/database";

import { StoredBudget } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";
import { SettingsInterface } from "../types/settings";
import {
  BudgetAmountChanges,
  buildBudgets,
  getBudgetPeriod,
} from "../utils/buildBudgets";
import { normalizeFrequency } from "../utils/normalizeFrequency";

// Expo's web server renderer imports this module. Opening SQLite there tries
// to attach browser devtools and throws because window does not exist.
if (Platform.OS !== "web") {
  setupDatabase();
}

interface BudgetState {
  incomes: IncomeInterface[];
  expenses: ExpenseInterface[];
  budgets: StoredBudget[];
  settings: SettingsInterface | null;
  loading: boolean;
  selectedMonth: number;
  selectedYear: number;
  generateAndSaveBudgets: () => Promise<void>;
  refreshBudgets: () => Promise<void>;
  setIncomes: (incomes: IncomeInterface[]) => void;
  setExpenses: (expenses: ExpenseInterface[]) => void;
  setBudgets: (budgets: StoredBudget[]) => void;
  setSettings: (settings: SettingsInterface) => void;
  setLoading: (loading: boolean) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  saveCurrency: (currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD") => void;
  saveTheme: (theme: "light" | "dark") => void;
  fetchAndCleanBudgets: () => Promise<void>;
  getExpenses: () => Promise<void>;
  addOrUpdateIncome: (incomeForm: Partial<IncomeInterface>) => Promise<void>;
  addOrUpdateExpense: (expenseForm: Partial<ExpenseInterface>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  updateIncomeAmount: (budgetId: string, newAmount: number) => Promise<void>;
  updateExpenseAmount: (
    budgetId: string,
    rowId: string,
    newAmount: number
  ) => Promise<void>;
  toggleExpensePaid: (
    budgetId: string,
    rowId: string,
    isPaid: boolean
  ) => Promise<void>;
  moveExpenseBetweenBudgets: (
    fromBudgetId: string,
    expenseId: string,
    toBudgetId: string,
    rowId: string,
    amount: number
  ) => Promise<void>;
  setPaidStatusInStorage: (
    budgetId: string,
    rowId: string,
    isPaid: boolean
  ) => Promise<void>;
  getPaidStatusFromStorage: (
    budgetId: string,
    rowId: string
  ) => Promise<boolean>;
  deleteExpenseFromBudget: (id: string, budgetId: string) => Promise<void>;
  updateExpenseOrder: (
    budgetId: string,
    newOrder: StoredBudget["bills"]
  ) => Promise<void>;
}

const rebuildBudgets = async (
  get: () => BudgetState,
  set: (partial: Partial<BudgetState>) => void,
  amountChanges?: BudgetAmountChanges
) => {
  await setupDatabase();
  const { incomes, expenses, budgets } = get();
  const { start, end } = getBudgetPeriod();
  const dismissedExpenseKeys = await getDismissedBudgetExpenseKeys();
  const nextBudgets = buildBudgets(
    incomes,
    expenses,
    start,
    end,
    budgets ?? [],
    amountChanges,
    dismissedExpenseKeys
  );

  await clearAllBudgets();

  for (const budget of nextBudgets) {
    try {
      await addOrUpdateBudget(budget);
    } catch (error) {
      console.error("Error saving budget:", error);
    }
  }

  set({ budgets: nextBudgets });
};

const useBudgetStore = create<BudgetState>((set, get) => ({
  incomes: [],
  expenses: [],
  budgets: [],
  settings: {
    theme: "dark",
    currency: "CAD",
  } as SettingsInterface,
  loading: false,
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),

  setIncomes: (incomes) => set({ incomes }),
  setExpenses: (expenses) => set({ expenses }),
  setBudgets: (budgets) => set({ budgets }),
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setSelectedYear: (year) => set({ selectedYear: year }),

  generateAndSaveBudgets: async () => {
    await rebuildBudgets(get, set);
  },

  refreshBudgets: async () => {
    try {
      await rebuildBudgets(get, set);
    } catch (e) {
      console.error("ERROR", e);
    }
  },

  fetchAndCleanBudgets: async () => {
    set({ loading: true });
    try {
      await setupDatabase();
      const incomes = await getIncomes();
      const expenses = await getExpenses();
      const budgets = await getBudgets();
      const settings = await getSettings();

      set({ incomes, expenses, budgets: budgets ?? [], settings });
      await rebuildBudgets(get, set);
    } catch (error) {
      console.error("❌ Error loading budgets:", error);
    } finally {
      set({ loading: false });
    }
  },

  getExpenses: async () => {
    try {
      const expenses = await getExpenses();
      set({ expenses });
    } catch (e) {
      console.error("Failed to load expenses", e);
    }
  },

  addOrUpdateIncome: async (incomeForm) => {
    const income: IncomeInterface = {
      id: incomeForm.id ?? uuid.v4().toString(),
      name: incomeForm.name!,
      date: incomeForm.date!,
      amount: incomeForm.amount!,
      frequency: normalizeFrequency(incomeForm.frequency),
    };
    const previous = get().incomes.find((item) => item.id === income.id);

    await addOrUpdateIncome(income);
    const currentIncomes = get().incomes;
    const incomeExists = currentIncomes.some((item) => item.id === income.id);
    set({
      incomes: incomeExists
        ? currentIncomes.map((item) => (item.id === income.id ? income : item))
        : [...currentIncomes, income],
    });
    await rebuildBudgets(
      get,
      set,
      previous
        ? { income: { id: income.id, previousAmount: previous.amount } }
        : undefined
    );
  },

  addOrUpdateExpense: async (expenseForm) => {
    const expense: ExpenseInterface = {
      id: expenseForm.id ?? uuid.v4().toString(),
      name: expenseForm.name!,
      date: expenseForm.date!,
      amount: expenseForm.amount!,
      frequency: normalizeFrequency(expenseForm.frequency),
    };
    const previous = get().expenses.find((item) => item.id === expense.id);

    await addOrUpdateExpense(expense);

    const currentExpenses = get().expenses;
    const expenseExists = currentExpenses.some((item) => item.id === expense.id);
    set({
      expenses: expenseExists
        ? currentExpenses.map((item) =>
            item.id === expense.id ? expense : item
          )
        : [...currentExpenses, expense],
    });
    await rebuildBudgets(
      get,
      set,
      previous
        ? { expense: { id: expense.id, previousAmount: previous.amount } }
        : undefined
    );
  },

  deleteIncome: async (id) => {
    await deleteIncome(id);
    set({ incomes: get().incomes.filter((income) => income.id !== id) });
    await get().refreshBudgets();
  },

  deleteExpense: async (id) => {
    await deleteExpense(id);
    set({ expenses: get().expenses.filter((expense) => expense.id !== id) });
    await get().refreshBudgets();
  },

  deleteBudget: async (id) => {
    await deleteBudget(id);

    set({ budgets: get().budgets.filter((budget) => budget.id !== id) });
  },

  deleteExpenseFromBudget: async (budgetId, id) => {
    const currentBudgets = get().budgets;
    const removedBill = currentBudgets
      .find((budget) => budget.id === budgetId)
      ?.bills.find((bill) => bill.id === id);
    try {
      if (removedBill?.expense?.id) {
        await dismissBudgetExpense(removedBill.expense.id, removedBill.expense.date);
      }
      // Optimistically update state first to avoid flicker
      const updatedBudgets = currentBudgets.map((budget) =>
        budget.id === budgetId
          ? {
              ...budget,
              bills: budget.bills.filter((bill) => bill.id !== id),
              remainingBalance:
                budget.amount -
                budget.bills
                  .filter((bill) => bill.id !== id)
                  .reduce((sum, b) => sum + b.amount, 0),
            }
          : budget
      );

      set({ budgets: updatedBudgets });
      // Then update database
      await deleteExpenseFromBudgetInDB(id, budgetId);
    } catch (e) {
      console.error(e);
      // On error, reload from database
      const budgets = await getBudgets();
      set({ budgets });
    }
  },

  updateExpenseOrder: async (
    budgetId: string,
    newOrder: StoredBudget["bills"]
  ) => {
    const currentBudgets = get().budgets;
    // Optimistically update state first to avoid flicker
    const updatedBudgets = currentBudgets.map((budget) =>
      budget.id === budgetId
        ? {
            ...budget,
            bills: newOrder.map((bill, i) => ({
              ...bill,
              sort_order: i,
            })),
          }
        : budget
    );

    set({ budgets: updatedBudgets });
    // Then update database
    await updateExpenseOrderInDB(
      budgetId,
      newOrder.map((bill) => ({ id: bill.id }))
    );
  },

  updateIncomeAmount: async (budgetId, newAmount) => {
    try {
      const updatedBudgets = get().budgets.map((budget) =>
        budget.id === budgetId
          ? {
              ...budget,
              amount: newAmount,
              income: {
                ...budget.income,
                amount: newAmount,
              },
              remainingBalance:
                newAmount - budget.bills.reduce((sum, bill) => sum + bill.amount, 0),
            }
          : budget
      );

      set({ budgets: updatedBudgets });
      await updateIncomeAmountInDB(budgetId, newAmount);
    } catch (error) {
      console.error(error);
      const budgets = await getBudgets();
      set({ budgets });
    }
  },

  updateExpenseAmount: async (budgetId, rowId, newAmount) => {
    try {
      const updatedBudgets = get().budgets.map((budget) =>
        budget.id === budgetId
          ? {
              ...budget,
              bills: budget.bills.map((bill) =>
                bill.id === rowId
                  ? {
                      ...bill,
                      amount: newAmount,
                      expense: {
                        ...bill.expense,
                        amount: newAmount,
                      },
                    }
                  : bill
              ),
              remainingBalance:
                budget.amount -
                budget.bills.reduce(
                  (sum, bill) =>
                    bill.id === rowId ? sum + newAmount : sum + bill.amount,
                  0
                ),
            }
          : budget
      );

      set({ budgets: updatedBudgets });
      await updateExpenseAmountInDB(budgetId, rowId, newAmount);
    } catch (error) {
      console.error(error);
      const budgets = await getBudgets();
      set({ budgets });
    }
  },

  setPaidStatusInStorage: async (budgetId, rowId, isPaid) => {
    await setPaidStatusInDB(budgetId, rowId, isPaid);

    set({
      budgets: get().budgets,
    });
  },

  getPaidStatusFromStorage: async (budgetId, rowId) => {
    return await getPaidStatusFromDB(budgetId, rowId);
  },

  toggleExpensePaid: async (budgetId, rowId, isPaid) => {
    const currentBudgets = get().budgets;
    // Optimistically update state first to avoid flicker
    const updatedBudgets = currentBudgets.map((budget) => {
      const isTargetBudget = budget.id === budgetId;

      if (!isTargetBudget) return budget;

      const updatedBills = budget.bills.map((bill) => {
        const isTargetBill = bill.id === rowId;

        if (isTargetBill) {
          return { ...bill, paid: isPaid };
        }

        return bill;
      });

      return {
        ...budget,
        bills: updatedBills,
      };
    });

    set({ budgets: updatedBudgets });
    // Then update database
    await setPaidStatusInDB(budgetId, rowId, isPaid);
  },

  moveExpenseBetweenBudgets: async (
    fromBudgetId,
    toBudgetId,
    expenseId,
    rowId,
    amount
  ) => {
    await moveExpenseBetweenBudgetsInDB(
      fromBudgetId,
      expenseId,
      toBudgetId,
      rowId,
      amount
    );
    set({
      budgets: get().budgets.map((budget) => {
        if (budget.id === fromBudgetId) {
          return {
            ...budget,
            bills: budget.bills.filter((bill) => bill.id !== rowId),
          };
        }
        if (budget.id === toBudgetId) {
          const movedExpense = get().expenses.find(
            (expense) => expense.id === expenseId
          );
          if (!movedExpense) return budget;
          return {
            ...budget,
            bills: [
              ...budget.bills,
              {
                id: rowId,
                expense: movedExpense,
                paid: false,
                amount: amount,
                sort_order: budget.bills.length,
              },
            ],
          };
        }
        return budget;
      }),
    });
  },

  saveCurrency: async (currency) => {
    try {
      await updateCurrency(currency);
      set({
        settings: { currency, theme: get().settings?.theme ?? "dark" },
      });
    } catch (e) {
      console.error("ERROR saving currency", e);
    }
  },

  saveTheme: async (theme) => {
    try {
      await updateTheme(theme);
      set({
        settings: { theme, currency: get().settings?.currency ?? "CAD" },
      });
    } catch (e) {
      console.error("ERROR saving theme", e);
    }
  },
}));

export default useBudgetStore;
