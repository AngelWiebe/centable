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

    // Calculate date range: beginning of last month to end of next 3 months
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 4); // Go to month after target
    endDate.setDate(0); // Last day of previous month (which is the target month)
    endDate.setHours(23, 59, 59, 999);

    // Generate occurrences and filter by date range
    const allIncomesRaw = generateOccurrences(incomes, endDate);
    const allExpensesRaw = generateOccurrences(expenses, endDate);

    const allIncomes = allIncomesRaw
      .filter((income) => {
        const incomeDate = new Date(income.date);
        return incomeDate >= startDate && incomeDate <= endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Sort expenses by highest amount first, then by date
    const allExpenses = allExpensesRaw
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      })
      .sort((a, b) => {
        // First sort by amount (descending - highest first)
        if (b.amount !== a.amount) {
          return b.amount - a.amount;
        }
        // Then by date (ascending)
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    const paidStatusCache = await getPaidStatusCache(
      allIncomes,
      allExpenses,
      getPaidStatusFromStorage
    );

    await clearAllBudgets();

    const failedExpenses: ExpenseInterface[] = [];
    const budgets: StoredBudget[] = allIncomes
      .map(createBudget)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

    // Assign each expense to the nearest income that occurs BEFORE it
    for (const expense of allExpenses) {
      const expenseDate = new Date(expense.date);
      expenseDate.setHours(0, 0, 0, 0); // Normalize to start of day
      let assigned = false;

      // Find the nearest income that occurs before this expense
      // Start from the end and work backwards to find the most recent prior income
      for (let i = budgets.length - 1; i >= 0; i--) {
        const budget = budgets[i];
        const incomeDate = new Date(budget.date);
        incomeDate.setHours(0, 0, 0, 0); // Normalize to start of day
        const overrideKey = `${budget.income.id}-${budget.date}`;
        const override = existingByIncomeId[overrideKey]?.[expense.id];
        const billAmount = override?.amount ?? expense.amount;

        // Income must occur STRICTLY before the expense (not on the same day)
        if (incomeDate.getTime() < expenseDate.getTime()) {
          // Check if this budget has remaining funds
          if (budget.remainingBalance >= billAmount) {
            const paid =
              override?.paid ??
              paidStatusCache[`${budget.income.id}-${expense.id}`] ??
              false;

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
            break; // Found the nearest prior income with funds
          }
          // If this income has no remaining funds, continue to previous income (fallback)
        }
      }

      if (!assigned) {
        failedExpenses.push(expense);
        console.warn(
          `Expense "${
            expense.name
          }" (${expenseDate.toISOString()}) could not be assigned to any budget`
        );
      }
    }

    try {
      // Insert budgets sequentially to avoid SQLite statement conflicts
      for (const budget of budgets) {
        try {
          await addOrUpdateBudget(budget);
        } catch (error) {
          console.error("Error saving budget:", error);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setBudgets(budgets);
  },

  refreshBudgets: async () => {
    try {
      const {
        incomes,
        expenses,
        budgets,
        setBudgets,
        getPaidStatusFromStorage,
      } = get();
      const assignedExpenses = new Set<string>();

      // Calculate date range: beginning of last month to end of next 3 months
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 4); // Go to month after target
      endDate.setDate(0); // Last day of previous month (which is the target month)
      endDate.setHours(23, 59, 59, 999);

      // Generate occurrences and filter by date range
      const allIncomesRaw = generateOccurrences(incomes, endDate);
      const allExpensesRaw = generateOccurrences(expenses, endDate);

      const allIncomes = allIncomesRaw
        .filter((income) => {
          const incomeDate = new Date(income.date);
          return incomeDate >= startDate && incomeDate <= endDate;
        })
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      // Sort expenses by highest amount first, then by date
      const allExpenses = allExpensesRaw
        .filter((expense) => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= startDate && expenseDate <= endDate;
        })
        .sort((a, b) => {
          // First sort by amount (descending - highest first)
          if (b.amount !== a.amount) {
            return b.amount - a.amount;
          }
          // Then by date (ascending)
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

      const paidStatusCache = await getPaidStatusCache(
        allIncomes,
        allExpenses,
        getPaidStatusFromStorage
      );

      const budgetMap = new Map(
        budgets.map((budget) => [`${budget.income.id}-${budget.date}`, budget])
      );
      // Build existing overrides for each budget occurrence by expense id
      // Only preserve amounts that differ from the expense amount (manual overrides)
      const existingByIncomeId: Record<
        string,
        Record<string, { amount: number; paid: boolean }>
      > = {};
      budgets.forEach((b) => {
        const key = `${b.income.id}-${b.date}`;
        existingByIncomeId[key] = existingByIncomeId[key] || {};
        b.bills.forEach((bill) => {
          // Find the current expense to compare amounts
          const currentExpense = expenses.find((e) => e.id === bill.expense.id);

          if (currentExpense) {
            // Check if bill amount differs from current expense amount
            // If it matches, it means it wasn't manually overridden, so use current expense amount
            // If it differs, it was manually overridden, so preserve it
            if (Math.abs(bill.amount - currentExpense.amount) > 0.01) {
              // This is a manual override (amounts differ), preserve it
              existingByIncomeId[key][bill.expense.id] = {
                amount: bill.amount,
                paid: bill.paid,
              };
            } else {
              // Amount matches expense (within rounding), use current expense amount
              // This ensures expense amount changes are reflected
              existingByIncomeId[key][bill.expense.id] = {
                amount: currentExpense.amount,
                paid: bill.paid,
              };
            }
          } else {
            // Expense not found (might have been deleted), preserve as-is for now
            existingByIncomeId[key][bill.expense.id] = {
              amount: bill.amount,
              paid: bill.paid,
            };
          }
        });
      });
      const failedExpenses: ExpenseInterface[] = [];
      const updatedBudgets: StoredBudget[] = [];

      // First, ensure all budgets exist and are properly initialized
      for (let i = 0; i < allIncomes.length; i++) {
        const income = allIncomes[i];
        const budgetKey = `${income.id}-${income.date}`;
        let budget = budgetMap.get(budgetKey);

        if (!budget) {
          // Create new budget if it doesn't exist
          budget = createBudget(income);
          budgetMap.set(budgetKey, budget);
        }
      }

      // Create budgets for all incomes
      const allBudgets: StoredBudget[] = allIncomes
        .map((income) => {
          const budgetKey = `${income.id}-${income.date}`;
          const existingBudget = budgetMap.get(budgetKey);
          if (existingBudget && existingBudget.remainingBalance >= 0) {
            // Preserve existing budget but reset bills for reassignment
            return {
              ...existingBudget,
              amount: income.amount,
              remainingBalance: income.amount,
              bills: [],
            };
          }
          return createBudget(income);
        })
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

      // Assign each expense to the nearest income that occurs BEFORE it
      // Expenses are already sorted by highest amount first
      for (const expense of allExpenses) {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0); // Normalize to start of day
        let assigned = false;

        // Find the nearest income that occurs before this expense
        // Start from the end and work backwards to find the most recent prior income
        for (let i = allBudgets.length - 1; i >= 0; i--) {
          const budget = allBudgets[i];
          const incomeDate = new Date(budget.date);
          incomeDate.setHours(0, 0, 0, 0); // Normalize to start of day
          const overrideKey = `${budget.income.id}-${budget.date}`;
          const override = existingByIncomeId[overrideKey]?.[expense.id];
          const billAmount = override?.amount ?? expense.amount;

          // Income must occur STRICTLY before the expense (not on the same day)
          if (incomeDate.getTime() < expenseDate.getTime()) {
            // Check if this budget has remaining funds
            if (budget.remainingBalance >= billAmount) {
              const paid =
                override?.paid ??
                paidStatusCache[`${budget.income.id}-${expense.id}`] ??
                false;

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
              break; // Found the nearest prior income with funds
            }
            // If this income has no remaining funds, continue to previous income (fallback)
          }
        }

        if (!assigned) {
          failedExpenses.push(expense);
          console.warn(
            `Expense "${
              expense.name
            }" (${expenseDate.toISOString()}) could not be assigned to any budget`
          );
        }
      }

      // Recalculate remaining balance for all budgets
      for (const budget of allBudgets) {
        budget.remainingBalance =
          budget.amount - budget.bills.reduce((s, b) => s + b.amount, 0);
        updatedBudgets.push(budget);
      }

      if (updatedBudgets.length > 0) {
        // Insert budgets sequentially to avoid SQLite statement conflicts
        for (const budget of updatedBudgets) {
          try {
            await addOrUpdateBudget(budget);
          } catch (error) {
            console.error("Error saving budget:", error);
          }
        }
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
    await get().refreshBudgets();
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
    await get().refreshBudgets();
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
