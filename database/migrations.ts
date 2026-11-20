import type { SQLiteDatabase } from "expo-sqlite";

export async function migrateDatabase(connection: SQLiteDatabase): Promise<void> {

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS incomes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT
    );
  `);

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT
    );
  `);

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      income_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      remaining_balance REAL NOT NULL,
      FOREIGN KEY (income_id) REFERENCES incomes(id)
    );
  `);

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS budget_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      budget_id TEXT NOT NULL,
      expense_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      expense_date TEXT,
      FOREIGN KEY (budget_id) REFERENCES budgets(id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    );
  `);

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS unfunded_budget_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      expense_id TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      amount REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      shortfall REAL NOT NULL
    );
  `);

  const migrations = {
    budgets: { amount_override: "INTEGER NOT NULL DEFAULT 0" },
    budget_expenses: {
      assignment_override: "INTEGER NOT NULL DEFAULT 0",
      amount_override: "INTEGER NOT NULL DEFAULT 0",
      expense_date: "TEXT",
      name: "TEXT",
    },
    unfunded_budget_expenses: { name: "TEXT", amount_override: "INTEGER NOT NULL DEFAULT 0" },
  };
  for (const [table, columns] of Object.entries(migrations)) {
    const existing = await connection.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    const names = new Set(existing.map(column => column.name));
    for (const [name, definition] of Object.entries(columns)) {
      if (!names.has(name)) await connection.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition};`);
    }
  }
  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS dismissed_budget_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      expense_id TEXT NOT NULL,
      expense_date TEXT NOT NULL
    );
  `);

  await connection.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      theme TEXT NOT NULL DEFAULT 'dark'
    );
  `);

  // Initialize settings if they don't exist
  const existingSettings = await connection.getFirstAsync<{ id: string }>(
    "SELECT id FROM settings WHERE id = ?;",
    ["settings_id"]
  );

  if (!existingSettings) {
    await connection.runAsync(
      "INSERT INTO settings (id, currency, theme) VALUES (?, ?, ?);",
      ["settings_id", "CAD", "dark"]
    );
  }
}
