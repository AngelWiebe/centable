import { migrateDatabase } from "./migrations";
import { FinancialEntry } from "../types/financialEntry";
import { forecastChanges } from "../utils/forecastChanges";
import { Platform } from "react-native";
import { remainingBalance as calculateRemainingBalance } from "../utils/money";
import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import uuid from "react-native-uuid";

import { BudgetForecast, StoredBudget, UnfundedExpense } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { FrequencyInterface } from "../types/frequency";
import { IncomeInterface } from "../types/income";
import { expenseOccurrenceKey, isManualBudgetExpense } from "../utils/buildBudgets";

let db: SQLiteDatabase | null = null;
let ready: Promise<void> | null = null;

type DataRow = {
  id: string;
  name: string;
  date: string;
  amount: number;
  frequency: string | null;
};

type BudgetRow = {
  amount: number;
  id: string;
  date: string;
  income_id: string;
  remaining_balance: number;
  amount_override?: number;
};

type ExpenseRow = {
  expense_id: string;
  amount: number;
  paid: number;
  id: string;
  sort_order: number;
  expense_date?: string;
  assignment_override?: number;
  amount_override?: number;
  name?: string | null;
};

/**
 * Initializes the SQLite database and creates necessary tables.
 */
export const setupDatabase = async () => {
  if (!ready) {
    ready = openAndMigrateDatabase().catch((error) => {
      ready = null;
      db = null;
      throw error;
    });
  }
  await ready;
};

const openAndMigrateDatabase = async () => {
  db = await openDatabaseAsync("budget.db");
  await migrateDatabase(db);
};

function entryFromRow(row: DataRow): FinancialEntry {
  return {
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    amount: row.amount,
    frequency: row.frequency ? JSON.parse(row.frequency) as FrequencyInterface : undefined,
  };
}

async function writeSeries(
  connection: Pick<SQLiteDatabase, "runAsync">,
  table: "incomes" | "expenses",
  item: Partial<FinancialEntry>
): Promise<string> {
  const id = item.id ?? uuid.v4().toString();
  await connection.runAsync(
    `INSERT INTO ${table} (id, name, date, amount, frequency)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, date = excluded.date,
       amount = excluded.amount, frequency = excluded.frequency;`,
    [id, item.name!, item.date!.toISOString(), item.amount!, item.frequency ? JSON.stringify(item.frequency) : null]
  );
  return id;
}

/**
 * Retrieves all incomes from the database.
 */
export const getIncomes = async (): Promise<IncomeInterface[]> => {
  if (!db) return [];

  const result = await db.getAllAsync<DataRow>("SELECT * FROM incomes;", []);

  return result.map(entryFromRow);
};

/**
 * Retrieves a single income record by ID.
 */
const getIncomeById = async (
  id: string
): Promise<IncomeInterface | null> => {
  if (!db) return null;

  const result = await db.getFirstAsync<DataRow>(
    "SELECT * FROM incomes WHERE id = ?;",
    [id]
  );
  if (!result) return null;

  return entryFromRow(result);
};

/**
 * Retrieves all expenses from the database.
 */
export const getExpenses = async (): Promise<ExpenseInterface[]> => {
  if (!db) return [];

  const result = await db.getAllAsync<DataRow>("SELECT * FROM expenses;", []);

  return result.map(entryFromRow);
};

/**
 * Retrieves a single expense record by ID.
 */
const getExpenseById = async (
  id: string
): Promise<ExpenseInterface | null> => {
  if (!db) return null;

  const result = await db.getFirstAsync<DataRow>(
    "SELECT * FROM expenses WHERE id = ?;",
    [id]
  );

  if (!result) return null;

  return entryFromRow(result);
};

export const getDismissedBudgetExpenseKeys = async (): Promise<string[]> => {
  if (!db) return [];
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM dismissed_budget_expenses;"
  );
  return rows.map((row) => row.id);
};

// Use the transaction's connection for every write and propagate every failure.
async function writeBudget(
  connection: Pick<SQLiteDatabase, "runAsync">,
  budget: StoredBudget,
  clearBills = true
): Promise<string> {
  const budgetId = budget.id ?? uuid.v4().toString();
  const dateString = typeof budget.date === "string"
    ? budget.date
    : new Date(budget.date).toISOString();

  await connection.runAsync(
    `INSERT INTO budgets (id, date, amount, income_id, remaining_balance, amount_override)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date,
       amount = excluded.amount,
       income_id = excluded.income_id,
       remaining_balance = excluded.remaining_balance, amount_override = excluded.amount_override;`,
    [budgetId, dateString, budget.amount, budget.income.id, budget.remainingBalance, budget.amountOverride ? 1 : 0]
  );
  if (clearBills) await connection.runAsync("DELETE FROM budget_expenses WHERE budget_id = ?;", [budgetId]);

  for (let index = 0; index < budget.bills.length; index++) {
    const bill = budget.bills[index];
    const expenseDate = typeof bill.expense.date === "string"
      ? bill.expense.date
      : bill.expense.date.toISOString();
    await connection.runAsync(
      `INSERT INTO budget_expenses (id, budget_id, expense_id, paid, amount, sort_order, expense_date, name, assignment_override, amount_override)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET paid = ?, amount = ?, sort_order = ?, expense_date = ?, name = ?, assignment_override = ?, amount_override = ?;`,
      [
        bill.id ?? uuid.v4().toString(), budgetId, bill.expense.id,
        bill.paid ? 1 : 0, bill.amount, index, expenseDate, bill.expense.name, bill.assignmentOverride ? 1 : 0, bill.amountOverride ? 1 : 0,
        bill.paid ? 1 : 0, bill.amount, index, expenseDate, bill.expense.name, bill.assignmentOverride ? 1 : 0, bill.amountOverride ? 1 : 0,
      ]
    );
  }
  return budgetId;
}

export type ForecastSeriesChange = {
  income?: IncomeInterface;
  expense?: ExpenseInterface;
  deleteIncomeId?: string;
  deleteExpenseId?: string;
  dismissExpense?: { id: string; date: Date };
};

/** Replace the entire forecast atomically; failed writes restore the old rows. */
export const replaceAllBudgets = async (
  budgets: StoredBudget[],
  unfundedExpenses: UnfundedExpense[] = [],
  seriesChange?: ForecastSeriesChange,
  previous?: BudgetForecast
): Promise<void> => {
  await setupDatabase();
  if (!db) throw new Error("Database is not initialized");
  const changes = previous ? forecastChanges(previous, { budgets, unfundedExpenses }) : undefined;
  if (changes && !seriesChange && !changes.changedBudgets.length && !changes.changedUnfunded.length && !changes.removedBudgetIds.length && !changes.clearUnfundedIds.length) return;
  const replace = async (transaction: Pick<SQLiteDatabase, "runAsync">) => {
    if (seriesChange?.income) await writeSeries(transaction, "incomes", seriesChange.income);
    if (seriesChange?.expense) await writeSeries(transaction, "expenses", seriesChange.expense);
    if (changes) {
      // Clear every affected assignment before inserting moves with stable row IDs.
      for (const id of changes.clearBudgetIds) await transaction.runAsync("DELETE FROM budget_expenses WHERE budget_id = ?;", [id]);
      for (const id of changes.removedBudgetIds) await transaction.runAsync("DELETE FROM budgets WHERE id = ?;", [id]);
      for (const id of changes.clearUnfundedIds) await transaction.runAsync("DELETE FROM unfunded_budget_expenses WHERE id = ?;", [id]);
    } else {
      await transaction.runAsync("DELETE FROM budget_expenses;", []);
      await transaction.runAsync("DELETE FROM budgets;", []);
      await transaction.runAsync("DELETE FROM unfunded_budget_expenses;", []);
    }
    if (seriesChange?.deleteIncomeId) {
      await transaction.runAsync("DELETE FROM incomes WHERE id = ?;", [seriesChange.deleteIncomeId]);
    }
    if (seriesChange?.deleteExpenseId) {
      await transaction.runAsync("DELETE FROM dismissed_budget_expenses WHERE expense_id = ?;", [seriesChange.deleteExpenseId]);
      await transaction.runAsync("DELETE FROM expenses WHERE id = ?;", [seriesChange.deleteExpenseId]);
    }
    if (seriesChange?.dismissExpense) {
      const item = seriesChange.dismissExpense;
      await transaction.runAsync(
        "INSERT OR REPLACE INTO dismissed_budget_expenses (id, expense_id, expense_date) VALUES (?, ?, ?);",
        [expenseOccurrenceKey(item.id, item.date), item.id, item.date.toISOString()]
      );
    }
    for (const budget of changes?.changedBudgets ?? budgets) {
      await writeBudget(transaction, budget, !changes);
    }
    for (const item of changes?.changedUnfunded ?? unfundedExpenses) {
      await transaction.runAsync(
        "INSERT INTO unfunded_budget_expenses (id, expense_id, expense_date, amount, paid, shortfall, name, amount_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        [item.id, item.expense.id, item.expense.date.toISOString(), item.amount, item.paid ? 1 : 0, item.shortfall, item.expense.name, item.amountOverride ? 1 : 0]
      );
    }
  };

  await runTransaction(replace);
};

/** Restore occurrence details before recalculating the forecast on load. */
export const getUnfundedExpenses = async (): Promise<UnfundedExpense[]> => {
  if (!db) return [];
  const rows = await db.getAllAsync<{
    id: string; expense_id: string; expense_date: string;
    amount: number; paid: number; shortfall: number; name?: string; amount_override?: number;
  }>("SELECT * FROM unfunded_budget_expenses ORDER BY expense_date, id;", []);
  const items: UnfundedExpense[] = [];
  for (const row of rows) {
    const expense = await getExpenseById(row.expense_id) ?? (isManualBudgetExpense(row.expense_id) ? {
      id: row.expense_id, name: row.name || "Expense", amount: row.amount,
      date: new Date(row.expense_date), frequency: undefined,
    } : null);
    if (!expense) continue;
    items.push({
      id: row.id, amount: row.amount, paid: row.paid === 1, shortfall: row.shortfall,
      ...(row.amount_override === 1 ? { amountOverride: true } : {}),
      expense: { ...expense, date: new Date(row.expense_date), amount: row.amount },
    });
  }
  return items;
};

const expenseForBudgetRow = (
  expenseRow: ExpenseRow,
  expense: ExpenseInterface | null
): ExpenseInterface | null => {
  const expenseDate = expenseRow.expense_date
    ? new Date(expenseRow.expense_date)
    : expense?.date;
  if (!expenseDate) return null;
  if (expense) {
    return {
      ...expense,
      amount: expenseRow.amount,
      date: expenseDate,
    };
  }
  if (!isManualBudgetExpense(expenseRow.expense_id)) return null;
  return {
    id: expenseRow.expense_id,
    name: expenseRow.name?.trim() || "Expense",
    date: expenseDate,
    amount: expenseRow.amount,
    frequency: undefined,
  };
};

async function runTransaction(task: (connection: SQLiteDatabase) => Promise<void>): Promise<void> {
  await setupDatabase();
  const connection = db;
  if (!connection) throw new Error("Database is not initialized");
  if (Platform.OS === "web") await connection.withTransactionAsync(() => task(connection));
  else await connection.withExclusiveTransactionAsync(task);
}

export const getBudgets = async (): Promise<StoredBudget[]> => {
  if (!db) throw new Error("Database is not initialized");

  // Fetch all budgets from the database
  const budgetsResult = await db.getAllAsync<BudgetRow>(
    "SELECT * FROM budgets;",
    []
  );
  const budgets: StoredBudget[] = [];

  for (const row of budgetsResult) {
    // Fetch related income
    const match = row.income_id.match(/^([a-f0-9-]{36})/);
    const baseId = match ? match[1] : row.income_id;

    const income = await getIncomeById(baseId);
    if (!income) continue;

    // Fetch related expenses for this budget
    const expensesResult = await db.getAllAsync<ExpenseRow>(
      "SELECT * FROM budget_expenses WHERE budget_id = ? ORDER BY sort_order ASC;",
      [row.id]
    );

    const bills = [];
    for (const expenseRow of expensesResult) {
      const match = expenseRow.expense_id.match(/^([a-f0-9-]{36})/);
      const baseId = match ? match[1] : expenseRow.expense_id;

      const expense = expenseForBudgetRow(
        expenseRow,
        await getExpenseById(baseId)
      );
      if (!expense) continue;

      bills.push({
        ...expenseRow,
        ...(expenseRow.assignment_override === 1 ? { assignmentOverride: true } : {}),
        ...(expenseRow.amount_override === 1 ? { amountOverride: true } : {}),
        amount: expenseRow.amount,
        expense,
        paid: expenseRow.paid === 1,
      });
    }

    budgets.push({
      id: row.id,
      date: row.date,
      income: {
        ...income,
        amount: row.amount,
        date: new Date(row.date),
      },
      amount: row.amount,
      bills,
      remainingBalance: calculateRemainingBalance(row.amount, bills.map((bill) => bill.amount)),
      ...(row.amount_override === 1 ? { amountOverride: true } : {}),
    });
  }

  return budgets;
};

/**
 * Updates the paid status of an expense in a budget.
 */
export const setPaidStatusInDB = async (
  budgetId: string,
  rowId: string,
  isPaid: boolean
) => {
  if (!db) throw new Error("Database is not initialized");

  const result = await db.runAsync(
    "UPDATE budget_expenses SET paid = ? WHERE budget_id = ? AND id = ?;",
    [isPaid ? 1 : 0, budgetId, rowId]
  );
  if (result.changes !== 1) throw new Error("Expense occurrence not found");
};

/**
 * Updates the order of expenses in a budget.
 */
export const updateExpenseOrderInDB = async (budgetId: string, newOrder: { id: string }[]) => {
  await runTransaction(async connection => {
    const rows = await connection.getAllAsync<{ id: string }>(
      "SELECT id FROM budget_expenses WHERE budget_id = ?;", [budgetId]
    );
    const ids = new Set(newOrder.map(item => item.id));
    if (rows.length !== newOrder.length || ids.size !== newOrder.length || rows.some(row => !ids.has(row.id))) {
      throw new Error("Expense order is stale; please refresh");
    }
    for (let index = 0; index < newOrder.length; index++) {
      const result = await connection.runAsync(
        "UPDATE budget_expenses SET sort_order = ? WHERE budget_id = ? AND id = ?;",
        [index, budgetId, newOrder[index].id]
      );
      if (result.changes !== 1) throw new Error("Expense occurrence not found");
    }
  });
};

/**
 * Updates the user's currency preference.
 */
export const updateCurrency = async (currency: string) => {
  if (!db) return;

  // Get current theme to preserve it
  const currentSettings = await db.getFirstAsync<{ theme: string }>(
    "SELECT theme FROM settings WHERE id = ?;",
    ["settings_id"]
  );

  const theme = currentSettings?.theme || "dark";

  await db.runAsync(
    "INSERT INTO settings (id, currency, theme) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET currency = excluded.currency;",
    ["settings_id", currency, theme]
  );
};

/**
 * Updates the user's theme preference.
 */
export const updateTheme = async (theme: "light" | "dark") => {
  if (!db) return;

  // Get current currency to preserve it
  const currentSettings = await db.getFirstAsync<{ currency: string }>(
    "SELECT currency FROM settings WHERE id = ?;",
    ["settings_id"]
  );

  const currency = currentSettings?.currency || "CAD";

  await db.runAsync(
    "INSERT INTO settings (id, currency, theme) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET theme = excluded.theme;",
    ["settings_id", currency, theme]
  );
};

/**
 * Retrieves user settings.
 */
export const getSettings = async (): Promise<{
  currency: string;
  theme: "dark" | "light";
}> => {
  if (!db) return { currency: "CAD", theme: "dark" };

  const result = await db.getFirstAsync<{
    currency: string;
    theme: "dark" | "light";
  }>("SELECT currency, theme FROM settings WHERE id = ?;", ["settings_id"]);

  return result ?? { currency: "CAD", theme: "dark" };
};
