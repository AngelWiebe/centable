import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import uuid from "react-native-uuid";

import { StoredBudget } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { FrequencyInterface } from "../types/frequency";
import { IncomeInterface } from "../types/income";

let db: SQLiteDatabase | null = null;

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
};

type ExpenseRow = {
  expense_id: string;
  amount: number;
  paid: number;
  id: string;
  sort_order: number;
};

export const resetTables = async () => {
  if (!db) return;

  try {
    await db.execAsync(`
      DROP TABLE IF EXISTS incomes;
      DROP TABLE IF EXISTS expenses;
      DROP TABLE IF EXISTS budgets;
      DROP TABLE IF EXISTS budget_expenses;
      DROP TABLE IF EXISTS settings;
    `);

    console.log("✅ Tables dropped successfully.");

    // Recreate tables
    await setupDatabase();
    console.log("✅ Tables recreated successfully.");
  } catch (error) {
    console.error("❌ Error resetting tables:", error);
  }
};

/**
 * Initializes the SQLite database and creates necessary tables.
 */
export const setupDatabase = async () => {
  db = await openDatabaseAsync("budget.db");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS incomes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      income_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      remaining_balance REAL NOT NULL,
      FOREIGN KEY (income_id) REFERENCES incomes(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS budget_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      budget_id TEXT NOT NULL,
      expense_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (budget_id) REFERENCES budgets(id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      theme TEXT NOT NULL DEFAULT 'dark'
    );
  `);
};

//
// ─── INCOME CRUD OPERATIONS ─────────────────────────────────────────────────────
//

/**
 * Inserts or updates an income record in the database.
 */
export const addOrUpdateIncome = async (income: Partial<IncomeInterface>) => {
  if (!db) return;

  await db.runAsync(
    `INSERT INTO incomes (id, name, date, amount, frequency) 
     VALUES (?, ?, ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET name=?, date=?, amount=?, frequency=?;`,
    [
      income.id!,
      income.name!,
      income.date!.toISOString(),
      income.amount!,
      income.frequency ? JSON.stringify(income.frequency) : null,
      income.name!,
      income.date!.toISOString(),
      income.amount!,
      income.frequency ? JSON.stringify(income.frequency) : null,
    ]
  );

  return income.id!;
};

/**
 * Retrieves all incomes from the database.
 */
export const getIncomes = async (): Promise<IncomeInterface[]> => {
  if (!db) return [];

  const result = await db.getAllAsync<DataRow>("SELECT * FROM incomes;", []);

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    amount: row.amount,
    frequency: row.frequency
      ? (JSON.parse(row.frequency) as FrequencyInterface)
      : undefined,
  }));
};

/**
 * Retrieves a single income record by ID.
 */
export const getIncomeById = async (
  id: string
): Promise<IncomeInterface | null> => {
  if (!db) return null;

  const result = await db.getFirstAsync<DataRow>(
    "SELECT * FROM incomes WHERE id = ?;",
    [id]
  );
  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    date: new Date(result.date),
    amount: result.amount,
    frequency: result.frequency
      ? (JSON.parse(result.frequency) as FrequencyInterface)
      : undefined,
  };
};

/**
 * Deletes an income record from the database.
 */
export const deleteIncome = async (id: string) => {
  if (!db) return;
  await db.runAsync("DELETE FROM incomes WHERE id = ?;", [id]);
};

/**
 * Updates an existing income record in the database.
 */
export const updateIncome = async (income: IncomeInterface) => {
  if (!db) return;

  await db.runAsync(
    `UPDATE incomes 
     SET name = ?, date = ?, amount = ?, frequency = ? 
     WHERE id = ?;`,
    [
      income.name,
      income.date.toISOString(),
      income.amount,
      income.frequency ? JSON.stringify(income.frequency) : null,
      income.id,
    ]
  );
};

//
// ─── EXPENSE CRUD OPERATIONS ────────────────────────────────────────────────────
//

/**
 * Inserts or updates an expense record in the database.
 */
export const addOrUpdateExpense = async (
  expense: Partial<ExpenseInterface>
) => {
  if (!db) return;

  const expenseId = expense.id ?? uuid.v4().toString();

  await db.runAsync(
    `INSERT INTO expenses (id, name, date, amount, frequency) 
     VALUES (?, ?, ?, ?, ?) 
     ON CONFLICT(id) DO UPDATE SET name=?, date=?, amount=?, frequency=?;`,
    [
      expenseId,
      expense.name!,
      expense.date!.toISOString(),
      expense.amount!,
      expense.frequency ? JSON.stringify(expense.frequency) : null,
      expense.name!,
      expense.date!.toISOString(),
      expense.amount!,
      expense.frequency ? JSON.stringify(expense.frequency) : null,
    ]
  );

  return expenseId;
};

/**
 * Retrieves all expenses from the database.
 */
export const getExpenses = async (): Promise<ExpenseInterface[]> => {
  if (!db) return [];

  const result = await db.getAllAsync<DataRow>("SELECT * FROM expenses;", []);

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    date: new Date(row.date),
    amount: row.amount,
    frequency: row.frequency
      ? (JSON.parse(row.frequency) as FrequencyInterface)
      : undefined,
  }));
};

/**
 * Retrieves a single expense record by ID.
 */
export const getExpenseById = async (
  id: string
): Promise<ExpenseInterface | null> => {
  if (!db) return null;

  const result = await db.getFirstAsync<DataRow>(
    "SELECT * FROM expenses WHERE id = ?;",
    [id]
  );

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    date: new Date(result.date),
    amount: result.amount,
    frequency: result.frequency
      ? (JSON.parse(result.frequency) as FrequencyInterface)
      : undefined,
  };
};

/**
 * Deletes an expense record from the database.
 */
export const deleteExpense = async (id: string) => {
  if (!db) return;
  await db.runAsync("DELETE FROM expenses WHERE id = ?;", [id]);
};

/**
 * Updates an existing expense record in the database.
 */
export const updateExpense = async (expense: ExpenseInterface) => {
  if (!db) return;

  await db.runAsync(
    `UPDATE expenses 
     SET name = ?, date = ?, amount = ?, frequency = ? 
     WHERE id = ?;`,
    [
      expense.name,
      expense.date.toISOString(),
      expense.amount,
      expense.frequency ? JSON.stringify(expense.frequency) : null,
      expense.id,
    ]
  );
};

//
// ─── BUDGET CRUD OPERATIONS ─────────────────────────────────────────────────────
//

/**
 * Inserts or updates a budget record in the database.
 */
export const addOrUpdateBudget = async (budget: StoredBudget) => {
  if (!db) return;
  const budgetId = budget.id ?? uuid.v4().toString();

  try {
    await db.runAsync(
      `INSERT INTO budgets (id, date, amount, income_id, remaining_balance) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT(id) DO UPDATE SET 
         date = excluded.date, 
         amount = excluded.amount, 
         income_id = excluded.income_id, 
         remaining_balance = excluded.remaining_balance;`,
      [
        budget.id,
        budget.date,
        budget.amount, // Ensure amount is included
        budget.income.id,
        budget.remainingBalance,
      ]
    );
  } catch (error) {
    console.error("❌ ERROR inserting budget:", error);
  }

  for (let index = 0; index < budget.bills.length; index++) {
    const bill = budget.bills[index];
    await db.runAsync(
      `INSERT INTO budget_expenses (id, budget_id, expense_id, paid, amount, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(id) DO UPDATE SET paid = ?, amount = ?, sort_order = ?;`,
      [
        bill.id ?? uuid.v4().toString(),
        budgetId,
        bill.expense.id,
        bill.paid ? 1 : 0,
        bill.amount,
        index, // Sort order
        bill.paid ? 1 : 0,
        bill.amount,
        index,
      ]
    );
  }

  return budgetId;
};

/**
 * Retrieves all budgets from the database.
 */
export const getBudgets = async (): Promise<StoredBudget[]> => {
  if (!db) return [];

  try {
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

      // TODO: change the amount used here or manual changes will be overwritten
      const bills = [];
      for (const expenseRow of expensesResult) {
        const match = expenseRow.expense_id.match(/^([a-f0-9-]{36})/);
        const baseId = match ? match[1] : expenseRow.expense_id;

        const expense = await getExpenseById(baseId);
        if (!expense) continue;

        bills.push({ ...expenseRow, expense, paid: expenseRow.paid === 1 });
      }

      budgets.push({
        id: row.id,
        date: row.date,
        income,
        amount: row.amount,
        bills,
        remainingBalance: row.remaining_balance,
      });
    }

    return budgets;
  } catch (e) {
    console.error(e);
  }
};

/**
 * Retrieves a single budget record by ID.
 */
export const getBudgetById = async (
  id: string
): Promise<StoredBudget | null> => {
  if (!db) return null;

  // Fetch the budget
  const budgetResult = await db.getFirstAsync<BudgetRow>(
    "SELECT * FROM budgets WHERE id = ?;",
    [id]
  );
  if (!budgetResult) return null;

  // Fetch the related income
  const income = await getIncomeById(budgetResult.income_id);
  if (!income) return null;

  const amount = income.amount;

  // Fetch the related expenses
  const expensesResult = await db.getAllAsync<ExpenseRow>(
    "SELECT * FROM budget_expenses WHERE budget_id = ? ORDER BY sort_order ASC;;",
    [id]
  );

  const bills = [];
  for (const expenseRow of expensesResult) {
    const expense = await getExpenseById(expenseRow.expense_id);
    if (!expense) continue;

    bills.push({ ...expenseRow, expense, paid: expenseRow.paid === 1 });
  }

  return {
    id: budgetResult.id,
    date: budgetResult.date,
    income,
    amount,
    bills,
    remainingBalance: budgetResult.remaining_balance,
  };
};

/**
 * Deletes a budget record from the database.
 */
export const deleteBudget = async (id: string) => {
  if (!db) return;

  await db.runAsync("DELETE FROM budget_expenses WHERE budget_id = ?;", [id]);
  await db.runAsync("DELETE FROM budgets WHERE id = ?;", [id]);
};

/**
 * Deletes all budget records from the database.
 */
export const clearAllBudgets = async () => {
  if (!db) return;

  await db.runAsync("DELETE FROM budget_expenses;", []);
  await db.runAsync("DELETE FROM budgets;", []);
};

/**
 * Deletes a budget record from the database.
 */
export const clearAllBudgetExpenses = async (budgetId: string) => {
  if (!db) return;

  await db.runAsync("DELETE FROM budget_expenses where budget_id=?;", [
    budgetId,
  ]);
};

/**
 * Deletes an expense from a budget.
 */
export const deleteExpenseFromBudgetInDB = async (
  rowId: string,
  budgetId: string
) => {
  if (!db) return;

  await db.runAsync(
    "DELETE FROM budget_expenses WHERE budget_id = ? AND id = ?;",
    [budgetId, rowId]
  );
};

/**
 * Retrieves the paid status of an expense.
 */
export const getPaidStatusFromDB = async (
  budgetId: string,
  rowId: string
): Promise<boolean> => {
  if (!db) return false;

  const result = await db.getFirstAsync<ExpenseRow>(
    "SELECT paid FROM budget_expenses WHERE budget_id = ? AND id = ?;",
    [budgetId, rowId]
  );

  return result ? result.paid === 1 : false;
};

/**
 * Moves an expense from one budget to another.
 */
export const moveExpenseBetweenBudgetsInDB = async (
  fromBudgetId: string,
  expenseId: string,
  toBudgetId: string,
  rowId: string,
  amount: number
) => {
  if (!db) return;

  // Remove from old budget
  await deleteExpenseFromBudgetInDB(rowId, fromBudgetId);

  // Find max sort_order for the new budget
  const maxOrderResult = await db.getFirstAsync<{ maxOrder: number }>(
    "SELECT MAX(sort_order) as maxOrder FROM budget_expenses WHERE budget_id = ?;",
    [toBudgetId]
  );

  const newSortOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

  // Insert into new budget with correct sort order
  await db.runAsync(
    "INSERT INTO budget_expenses (id, budget_id, expense_id, paid, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?);",
    [uuid.v4().toString(), toBudgetId, expenseId, 0, amount, newSortOrder]
  );
};

/**
 * Updates the paid status of an expense in a budget.
 */
export const setPaidStatusInDB = async (
  budgetId: string,
  rowId: string,
  isPaid: boolean
) => {
  if (!db) return;

  await db.runAsync(
    "UPDATE budget_expenses SET paid = ? WHERE budget_id = ? AND id = ?;",
    [isPaid ? 1 : 0, budgetId, rowId]
  );
};

/**
 * Toggles the paid status of an expense.
 */
export const toggleExpensePaidInDB = async (
  budgetId: string,
  expenseId: string
) => {
  if (!db) return;

  const currentStatus = await getPaidStatusFromDB(budgetId, expenseId);
  await setPaidStatusInDB(budgetId, expenseId, !currentStatus);
  return !currentStatus;
};

/**
 * Updates an expense amount in a budget.
 */
export const updateExpenseAmountInDB = async (
  budgetId: string,
  rowId: string,
  newAmount: number
) => {
  if (!db) return;

  await db.runAsync(
    "UPDATE budget_expenses SET amount = ? WHERE budget_id = ? AND id = ?;",
    [newAmount, budgetId, rowId]
  );
};

/**
 * Updates the order of expenses in a budget.
 */
export const updateExpenseOrderInDB = async (
  budgetId: string,
  newOrder: ExpenseRow[]
) => {
  if (!db) return;

  for (let index = 0; index < newOrder.length; index++) {
    const expense = newOrder[index];

    await db.runAsync(
      "UPDATE budget_expenses SET sort_order = ? WHERE budget_id = ? AND id = ?;",
      [index, budgetId, expense.id]
    );
  }
};

/**
 * Updates the income amount in a budget.
 */
export const updateIncomeAmountInDB = async (
  budgetId: string,
  newAmount: number
) => {
  if (!db) return;

  await db.runAsync("UPDATE budgets SET amount = ? WHERE id = ?", [
    newAmount,
    budgetId,
  ]);
};

/**
 * Updates the user's currency preference.
 */
export const updateCurrency = async (currency: string) => {
  if (!db) return;
  await db.runAsync("UPDATE settings SET currency = ? WHERE id = ?;", [
    currency,
    "settings_id",
  ]);
};

/**
 * Updates the user's theme preference.
 */
export const updateTheme = async (theme: "light" | "dark") => {
  if (!db) return;
  await db.runAsync("UPDATE settings SET theme = ? WHERE id = ?;", [
    theme,
    "settings_id",
  ]);
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
