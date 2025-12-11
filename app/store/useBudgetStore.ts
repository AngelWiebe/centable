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
  getBudgets,
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
} from "../../database/database";

import { StoredBudget } from "../../types/budget";
import { ExpenseInterface } from "../../types/expense";
import { IncomeInterface } from "../../types/income";
import { SettingsInterface } from "../../types/settings";
import { generateOccurrences } from "../../utils/generateOccurrences";

setupDatabase();

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
  updateExpenseOrder: (budgetId: string, newOrder: any) => Promise<void>;
}

const getPaidStatusCache = async (
  incomes: IncomeInterface[],
  expenses: ExpenseInterface[],
  getPaidStatusFromStorage: (
    incomeId: string,
    expenseId: string
  ) => Promise<boolean>
) => {
  const paidStatusCache: Record<string, boolean> = {};

  await Promise.all(
    expenses.map(async (expense) => {
      await Promise.all(
        incomes.map(async (income) => {
          const key = `${income.id}-${expense.id}`;
          if (!(key in paidStatusCache)) {
            paidStatusCache[key] = await getPaidStatusFromStorage(
              income.id,
              expense.id
            );
          }
        })
      );
    })
  );

  return paidStatusCache;
};

const createBudget = (income: IncomeInterface): StoredBudget => ({
  id: uuid.v4().toString(),
  date: income.date.toISOString(),
  income,
  amount: income.amount ?? 0,
  bills: [],
  remainingBalance: income.amount,
});

const assignExpensesToBudget = (
  budget: StoredBudget,
  expenses: ExpenseInterface[],
  paidStatusCache: Record<string, boolean>,
  failedExpenses: ExpenseInterface[],
  nextIncomeDate: Date | null,
  assignedExpenses: Set<string>
) => {
  for (const expense of expenses) {
    const expenseDate = new Date(expense.date);
    const assignmentKey = `${expense.id}-${expenseDate.toISOString()}`;

    if (assignedExpenses.has(assignmentKey)) continue;
    if (expenseDate < new Date(budget.date)) continue;
    if (nextIncomeDate && expenseDate >= nextIncomeDate) continue;

    if (budget.remainingBalance >= expense.amount) {
      const paid =
        paidStatusCache[`${budget.income.id}-${expense.id}`] ?? false;
      budget.remainingBalance -= expense.amount;
      budget.bills.push({
        id: uuid.v4().toString(),
        amount: expense.amount,
        expense: {
          ...expense,
          date: expenseDate,
        },
        paid,
        sort_order: budget.bills.length,
      });
      assignedExpenses.add(assignmentKey);
    } else {
      failedExpenses.push(expense);
    }
  }
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
    const { incomes, expenses, setBudgets, getPaidStatusFromStorage } = get();
    console.log("GENERATE");

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    const allIncomes = generateOccurrences(incomes, endDate).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const allExpenses = generateOccurrences(expenses, endDate).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const paidStatusCache = await getPaidStatusCache(
      allIncomes,
      allExpenses,
      getPaidStatusFromStorage
    );

    await clearAllBudgets();

    const failedExpenses: ExpenseInterface[] = [];
    const budgets: StoredBudget[] = allIncomes.map(createBudget);

    // Build existing overrides by expense id per income occurrence (if any in current store)
    const existingByIncomeId: Record<
      string,
      Record<string, { amount: number; paid: boolean }>
    > = {};
    get().budgets.forEach((b) => {
      const key = `${b.income.id}-${b.date}`;
      existingByIncomeId[key] = existingByIncomeId[key] || {};
      b.bills.forEach((bill) => {
        existingByIncomeId[key][bill.expense.id] = {
          amount: bill.amount,
          paid: bill.paid,
        };
      });
    });

    for (const expense of allExpenses) {
      const expenseDate = new Date(expense.date);
      let assigned = false;

      for (const budget of budgets) {
        const incomeDate = new Date(budget.date);
        if (
          incomeDate >= expenseDate &&
          budget.remainingBalance >= expense.amount
        ) {
          const overrideKey = `${budget.income.id}-${budget.date}`;
          const override = existingByIncomeId[overrideKey]?.[expense.id];
          const paid =
            override?.paid ??
            paidStatusCache[`${budget.income.id}-${expense.id}`] ??
            false;
          const billAmount = override?.amount ?? expense.amount;
          budget.bills.push({
            id: uuid.v4().toString(),
            amount: billAmount,
            expense: {
              ...expense,
              date: expenseDate,
            },
            paid,
            sort_order: budget.bills.length,
          });

          budget.remainingBalance -= billAmount;
          assigned = true;
          break;
        }
      }

      if (!assigned) failedExpenses.push(expense);
    }

    try {
      await Promise.all(budgets.map((b) => addOrUpdateBudget(b)));
    } catch (e) {
      console.error(e);
    }
    setBudgets(budgets);
  },

  refreshBudgets: async () => {
    try {
      console.log("REFRESH");
      const {
        incomes,
        expenses,
        budgets,
        setBudgets,
        getPaidStatusFromStorage,
      } = get();
      const assignedExpenses = new Set<string>();

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const allIncomes = generateOccurrences(incomes, endDate);
      const allExpenses = generateOccurrences(expenses, endDate);

      const paidStatusCache = await getPaidStatusCache(
        allIncomes,
        allExpenses,
        getPaidStatusFromStorage
      );

      const budgetMap = new Map(
        budgets.map((budget) => [`${budget.income.id}-${budget.date}`, budget])
      );
      // Build existing overrides for each budget occurrence by expense id
      const existingByIncomeId: Record<
        string,
        Record<string, { amount: number; paid: boolean }>
      > = {};
      budgets.forEach((b) => {
        const key = `${b.income.id}-${b.date}`;
        existingByIncomeId[key] = existingByIncomeId[key] || {};
        b.bills.forEach((bill) => {
          existingByIncomeId[key][bill.expense.id] = {
            amount: bill.amount,
            paid: bill.paid,
          };
        });
      });
      const failedExpenses: ExpenseInterface[] = [];
      const updatedBudgets: StoredBudget[] = [];

      for (let i = 0; i < allIncomes.length; i++) {
        const income = allIncomes[i];
        const nextIncomeDate = allIncomes[i + 1]?.date || null;
        const budgetKey = `${income.id}-${income.date}`;
        let budget = budgetMap.get(budgetKey);

        if (!budget || budget.remainingBalance < 0) {
          budget = budget ? { ...budget } : createBudget(income);
          budget.amount = income.amount;
          budget.remainingBalance = income.amount;
          budget.bills = [];

          assignExpensesToBudget(
            budget,
            allExpenses,
            paidStatusCache,
            failedExpenses,
            nextIncomeDate,
            assignedExpenses
          );
          // Apply overrides for amounts/paid where possible
          const overrideKey = `${income.id}-${income.date.toISOString()}`;
          budget.bills = budget.bills.map((bill) => {
            const override = existingByIncomeId[overrideKey]?.[bill.expense.id];
            const amount = override?.amount ?? bill.amount;
            const paid = override?.paid ?? bill.paid;
            return { ...bill, amount, paid };
          });
          budget.remainingBalance =
            budget.amount - budget.bills.reduce((s, b) => s + b.amount, 0);
          updatedBudgets.push(budget);
        }
      }

      if (updatedBudgets.length > 0) {
        await Promise.all(
          updatedBudgets.map((budget) => addOrUpdateBudget(budget))
        );
        setBudgets(updatedBudgets);
      }
    } catch (e) {
      console.error("ERROR", e);
    }
  },

  fetchAndCleanBudgets: async () => {
    set({ loading: true });
    try {
      const incomes = await getIncomes();
      const expenses = await getExpenses();
      const budgets = await getBudgets();
      const settings = await getSettings();

      console.log("CLEAN", budgets.length);
      set({ incomes, expenses, budgets, settings });
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
      frequency: incomeForm.frequency,
    };

    await addOrUpdateIncome(income);
    set({
      incomes: [...get().incomes.filter((i) => i.id !== income.id), income],
    });
  },

  addOrUpdateExpense: async (expenseForm) => {
    const expense: ExpenseInterface = {
      id: expenseForm.id ?? uuid.v4().toString(),
      name: expenseForm.name!,
      date: expenseForm.date!,
      amount: expenseForm.amount!,
      frequency: expenseForm.frequency,
    };

    await addOrUpdateExpense(expense);

    set({
      expenses: [...get().expenses.filter((e) => e.id !== expense.id), expense],
    });
  },

  deleteIncome: async (id) => {
    await deleteIncome(id);
    set({ incomes: get().incomes.filter((income) => income.id !== id) });
  },

  deleteExpense: async (id) => {
    await deleteExpense(id);
    set({ expenses: get().expenses.filter((expense) => expense.id !== id) });
  },

  deleteBudget: async (id) => {
    await deleteBudget(id);

    set({ budgets: get().budgets.filter((budget) => budget.id !== id) });
  },

  deleteExpenseFromBudget: async (budgetId, id) => {
    const { setBudgets } = get();

    try {
      await deleteExpenseFromBudgetInDB(id, budgetId);
      const budgets = get().budgets.map((budget) =>
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

      setBudgets(budgets);
    } catch (e) {
      console.error(e);
    }
  },

  updateExpenseOrder: async (budgetId, newOrder) => {
    await updateExpenseOrderInDB(
      budgetId,
      newOrder.map((b: any) => ({ id: b.id }))
    );
    const { setBudgets } = get();

    const budgets = get().budgets.map((budget) =>
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

    setBudgets(budgets);
  },

  updateIncomeAmount: async (budgetId, newAmount) => {
    try {
      const { setBudgets } = get();
      await updateIncomeAmountInDB(budgetId, newAmount);
      const budgets = get().budgets.map((budget) =>
        budget.id === budgetId
          ? {
              ...budget,
              amount: newAmount,
              income: {
                ...budget.income,
                amount: newAmount,
              },
              remainingBalance:
                newAmount - budget.bills.reduce((sum, b) => sum + b.amount, 0),
            }
          : budget
      );

      setBudgets(budgets);
    } catch (error) {
      console.error(error);
    }
  },

  updateExpenseAmount: async (budgetId, rowId, newAmount) => {
    await updateExpenseAmountInDB(budgetId, rowId, newAmount);
    const { setBudgets } = get();

    const budgets = get().budgets.map((budget) =>
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
                (sum, b) => (b.id === rowId ? sum + newAmount : sum + b.amount),
                0
              ),
          }
        : budget
    );

    setBudgets(budgets);
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
    await setPaidStatusInDB(budgetId, rowId, isPaid);

    const updatedBudgets = get().budgets.map((budget) => {
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

    get().setBudgets(updatedBudgets);
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
