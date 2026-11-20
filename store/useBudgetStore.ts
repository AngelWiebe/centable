import { createMutationQueue } from "./mutationQueue";
import { normalizeMoneyAmount } from "../utils/money";
import uuid from "react-native-uuid";
import { create } from "zustand";

import {
  type ForecastSeriesChange,
  getBudgets,
  getUnfundedExpenses,
  getDismissedBudgetExpenseKeys,
  getExpenses,
  getIncomes,
  getSettings,
  replaceAllBudgets,
  setPaidStatusInDB,
  setupDatabase,
  updateCurrency,
  updateExpenseOrderInDB,
  updateTheme,
} from "../database/database";

import { StoredBudget, UnfundedExpense } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";
import { currencySettings, SettingsInterface } from "../types/settings";
import {
  BudgetAmountChanges,
  buildBudgetForecast,
  getBudgetPeriod,
  getBudgetCalculationStart,
  isManualBudgetExpense,
  manualExpenseId,
  expenseOccurrenceKey,
} from "../utils/buildBudgets";
import { atLocalNoon } from "../utils/occurrenceDates";
import { normalizeFrequency } from "../utils/normalizeFrequency";

interface BudgetState {
  incomes: IncomeInterface[];
  expenses: ExpenseInterface[];
  budgets: StoredBudget[];
  unfundedExpenses: UnfundedExpense[];
  settings: SettingsInterface | null;
  loading: boolean;
  loadError: string | null;
  selectedMonth: number;
  selectedYear: number;
  refreshBudgets: () => Promise<void>;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  saveCurrency: (currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD") => Promise<void>;
  saveTheme: (theme: "light" | "dark") => Promise<void>;
  fetchAndCleanBudgets: () => Promise<void>;
  getExpenses: () => Promise<void>;
  addOrUpdateIncome: (incomeForm: Partial<IncomeInterface>) => Promise<void>;
  addOrUpdateExpense: (expenseForm: Partial<ExpenseInterface>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
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
    toBudgetId: string,
    expenseId: string,
    rowId: string,
    amount: number
  ) => Promise<void>;
  deleteExpenseFromBudget: (id: string, budgetId: string) => Promise<void>;
  addExpenseToBudget: (
    budgetId: string,
    expense: { name: string; amount: number; date: Date }
  ) => Promise<void>;
  updateExpenseOrder: (
    budgetId: string,
    newOrder: StoredBudget["bills"]
  ) => Promise<void>;
}

function updateSeries<T extends { id: string }>(items: T[], updated: T): T[] {
  return items.some((item) => item.id === updated.id)
    ? items.map((item) => item.id === updated.id ? updated : item)
    : [...items, updated];
}

interface RebuildBudgetOptions {
  amountChanges?: BudgetAmountChanges;
  seriesChange?: ForecastSeriesChange;
  occurrenceBudgets?: StoredBudget[];
}

const rebuildBudgets = async (
  get: () => BudgetState,
  set: (partial: Partial<BudgetState>) => void,
  options: RebuildBudgetOptions = {}
) => {
  const { amountChanges, seriesChange, occurrenceBudgets } = options;
  await setupDatabase();
  const current = get();
  const { unfundedExpenses } = current;
  const budgets = occurrenceBudgets ?? current.budgets;
  const incomes = (seriesChange?.income ? updateSeries(current.incomes, seriesChange.income) : current.incomes)
    .filter(item => item.id !== seriesChange?.deleteIncomeId);
  const expenses = (seriesChange?.expense ? updateSeries(current.expenses, seriesChange.expense) : current.expenses)
    .filter(item => item.id !== seriesChange?.deleteExpenseId);
  const { start, end } = getBudgetPeriod(new Date(), incomes);
  const dismissedExpenseKeys = [...await getDismissedBudgetExpenseKeys()];
  if (seriesChange?.dismissExpense) {
    dismissedExpenseKeys.push(expenseOccurrenceKey(seriesChange.dismissExpense.id, seriesChange.dismissExpense.date));
  }
  const forecast = buildBudgetForecast(
    incomes,
    expenses,
    getBudgetCalculationStart(start, incomes, budgets ?? []),
    end,
    budgets ?? [],
    amountChanges,
    dismissedExpenseKeys,
    unfundedExpenses
  );

  await replaceAllBudgets(forecast.budgets, forecast.unfundedExpenses, seriesChange, {
    budgets: current.budgets, unfundedExpenses: current.unfundedExpenses,
  });

  // Publish the source records and their forecast only after the shared commit.
  set({ ...forecast, incomes, expenses });
};

/** Shared by startup and refresh retries; never interpret a read failure as empty data. */
async function loadSavedBudgets(get: () => BudgetState, set: (partial: Partial<BudgetState>) => void) {
  set({ loading: true });
  try {
    await setupDatabase();
    const incomes = await getIncomes();
    const expenses = await getExpenses();
    const budgets = await getBudgets();
    const unfundedExpenses = await getUnfundedExpenses();
    const settings = await getSettings();
    set({ incomes, expenses, budgets, unfundedExpenses, settings });
    await rebuildBudgets(get, set);
    set({ loadError: null });
  } catch (error) {
    set({ loadError: "Unable to load saved budgets. Refresh to try again." });
    throw error;
  } finally {
    set({ loading: false });
  }
}

async function persistPaidStatus(
  get: () => BudgetState,
  set: (partial: Partial<BudgetState>) => void,
  budgetId: string,
  rowId: string,
  paid: boolean
) {
  const current = get().budgets.find(budget => budget.id === budgetId);
  if (!current?.bills.some(bill => bill.id === rowId)) throw new Error("Expense occurrence not found");
  await setPaidStatusInDB(budgetId, rowId, paid);
  set({ budgets: get().budgets.map(budget => budget.id === budgetId
    ? { ...budget, bills: budget.bills.map(bill => bill.id === rowId ? { ...bill, paid } : bill) }
    : budget) });
}

const useBudgetStore = create<BudgetState>((set, get) => {
  const queue = createMutationQueue();
  const state: BudgetState = {
    incomes: [],
    expenses: [],
    budgets: [],
    unfundedExpenses: [],
    settings: {
      theme: "dark",
      currency: "CAD",
    } as SettingsInterface,
    loading: false,
    loadError: null,
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),

    setSelectedMonth: (month) => set({ selectedMonth: month }),
    setSelectedYear: (year) => set({ selectedYear: year }),

    refreshBudgets: queue(async () => {
      if (get().loadError) await loadSavedBudgets(get, set);
      else await rebuildBudgets(get, set);
    }),

    fetchAndCleanBudgets: queue(async () => {
      await loadSavedBudgets(get, set);
    }),

    getExpenses: queue(async () => {
      await setupDatabase();
      const expenses = await getExpenses();
      set({ expenses });
    }),

    addOrUpdateIncome: queue(async (incomeForm) => {
      const income: IncomeInterface = {
        id: incomeForm.id ?? uuid.v4().toString(),
        name: incomeForm.name!,
        date: incomeForm.date!,
        amount: normalizeMoneyAmount(incomeForm.amount!, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2),
        frequency: normalizeFrequency(incomeForm.frequency),
      };
      const previous = get().incomes.find((item) => item.id === income.id);

      await rebuildBudgets(
        get,
        set,
        {
          amountChanges: previous
            ? { income: { id: income.id, previousAmount: previous.amount } }
            : undefined,
          seriesChange: { income },
        }
      );
    }),

    addOrUpdateExpense: queue(async (expenseForm) => {
      const expense: ExpenseInterface = {
        id: expenseForm.id ?? uuid.v4().toString(),
        name: expenseForm.name!,
        date: expenseForm.date!,
        amount: normalizeMoneyAmount(expenseForm.amount!, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2),
        frequency: normalizeFrequency(expenseForm.frequency),
      };
      const previous = get().expenses.find((item) => item.id === expense.id);

      await rebuildBudgets(
        get,
        set,
        {
          amountChanges: previous
            ? { expense: { id: expense.id, previousAmount: previous.amount } }
            : undefined,
          seriesChange: { expense },
        }
      );
    }),

    deleteIncome: queue(async (id) => {
      await rebuildBudgets(get, set, { seriesChange: { deleteIncomeId: id } });
    }),

    deleteExpense: queue(async (id) => {
      await rebuildBudgets(get, set, { seriesChange: { deleteExpenseId: id } });
    }),

    deleteExpenseFromBudget: queue(async (budgetId, id) => {
      const current = get().budgets.find(budget => budget.id === budgetId);
      const removed = current?.bills.find(bill => bill.id === id);
      if (!removed) throw new Error("Expense occurrence not found");
      const updated = get().budgets.map(budget => budget.id === budgetId
        ? { ...budget, bills: budget.bills.filter(bill => bill.id !== id) }
        : budget);
      const change = isManualBudgetExpense(removed.expense.id) ? undefined
        : { dismissExpense: { id: removed.expense.id, date: removed.expense.date } };
      await rebuildBudgets(get, set, { seriesChange: change, occurrenceBudgets: updated });
    }),

    addExpenseToBudget: queue(async (budgetId, { name, amount, date }) => {
      const title = name.trim();
      amount = normalizeMoneyAmount(amount, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2);
      if (!title || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(date?.getTime())) {
        throw new Error("Enter a valid name, amount and date");
      }
      const current = get().budgets.find(budget => budget.id === budgetId);
      if (!current) throw new Error("Budget not found");
      const id = String(uuid.v4());
      const bill: StoredBudget["bills"][number] = {
        id, amount, paid: false, sort_order: current.bills.length,
        expense: { id: manualExpenseId(id), name: title, date: atLocalNoon(date), amount, frequency: undefined },
      };
      const updated = get().budgets.map(budget => budget.id === budgetId
        ? { ...budget, bills: [...budget.bills, bill] }
        : budget);
      await rebuildBudgets(get, set, { occurrenceBudgets: updated });
    }),

    updateExpenseOrder: queue(async (budgetId, newOrder) => {
      const current = get().budgets.find(budget => budget.id === budgetId);
      const ids = new Set(newOrder.map(bill => bill.id));
      if (!current || current.bills.length !== newOrder.length || ids.size !== newOrder.length || current.bills.some(bill => !ids.has(bill.id))) {
        throw new Error("Expense order is stale; please refresh");
      }
      const byId = new Map(current.bills.map(bill => [bill.id, bill]));
      const bills = newOrder.map((bill, index) => ({ ...byId.get(bill.id)!, sort_order: index }));
      await updateExpenseOrderInDB(budgetId, bills.map(bill => ({ id: bill.id })));
      set({ budgets: get().budgets.map(budget => budget.id === budgetId ? { ...budget, bills } : budget) });
    }),

    updateIncomeAmount: queue(async (budgetId, newAmount) => {
      newAmount = normalizeMoneyAmount(newAmount, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2);
      if (!get().budgets.some(budget => budget.id === budgetId)) throw new Error("Budget not found");
      const updated = get().budgets.map(budget => budget.id === budgetId
        ? { ...budget, amount: newAmount, amountOverride: true, income: { ...budget.income, amount: newAmount } }
        : budget);
      await rebuildBudgets(get, set, { occurrenceBudgets: updated });
    }),

    updateExpenseAmount: queue(async (budgetId, rowId, newAmount) => {
      newAmount = normalizeMoneyAmount(newAmount, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2);
      const current = get().budgets.find(budget => budget.id === budgetId);
      if (!current?.bills.some(bill => bill.id === rowId)) throw new Error("Expense occurrence not found");
      const updated = get().budgets.map(budget => budget.id === budgetId
        ? { ...budget, bills: budget.bills.map(bill => bill.id === rowId
          ? { ...bill, amount: newAmount, amountOverride: true, expense: { ...bill.expense, amount: newAmount } }
          : bill) }
        : budget);
      await rebuildBudgets(get, set, { occurrenceBudgets: updated });
    }),

    toggleExpensePaid: queue(async (budgetId, rowId, isPaid) => {
      await persistPaidStatus(get, set, budgetId, rowId, isPaid);
    }),

    moveExpenseBetweenBudgets: queue(async (
      fromBudgetId,
      toBudgetId,
      expenseId,
      rowId,
      amount
    ) => {
      if (fromBudgetId === toBudgetId) return;
      const movedBill = get().budgets
        .find((budget) => budget.id === fromBudgetId)
        ?.bills.find((bill) => bill.id === rowId && bill.expense.id === expenseId);
      const destination = get().budgets.find((budget) => budget.id === toBudgetId);
      if (!movedBill || !destination) throw new Error("Source expense or destination budget not found");

      amount = normalizeMoneyAmount(amount, currencySettings[get().settings?.currency ?? "CAD"]?.decimals ?? 2);
      const updated = get().budgets.map(budget => {
        if (budget.id === fromBudgetId) return { ...budget, bills: budget.bills.filter(bill => bill.id !== rowId) };
        if (budget.id === toBudgetId) return {
          ...budget,
          bills: [...budget.bills, {
            ...movedBill, assignmentOverride: true,
            amountOverride: movedBill.amountOverride || amount !== movedBill.amount,
            amount, expense: { ...movedBill.expense, amount }, sort_order: budget.bills.length,
          }],
        };
        return budget;
      });
      await rebuildBudgets(get, set, { occurrenceBudgets: updated });
    }),

    saveCurrency: queue(async (currency) => {
      try {
        await updateCurrency(currency);
        set({
          settings: { currency, theme: get().settings?.theme ?? "dark" },
        });
      } catch (e) {
        console.error("ERROR saving currency", e);
      }
    }),

    saveTheme: queue(async (theme) => {
      try {
        await updateTheme(theme);
        set({
          settings: { theme, currency: get().settings?.currency ?? "CAD" },
        });
      } catch (e) {
        console.error("ERROR saving theme", e);
      }
    }),
  };
  return state;
});

export default useBudgetStore;
