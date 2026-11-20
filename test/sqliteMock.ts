import type { SQLiteDatabase } from "expo-sqlite";

function statements() {
  return {
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn().mockResolvedValue([]),
  };
}

/** Native transactions may use a separate connection; web uses the main one. */
export function createSQLiteMock(options: { sharedStatements?: boolean } = {}) {
  const transaction = statements();
  const queries = options.sharedStatements ? transaction : statements();
  const db = {
    ...queries,
    execAsync: jest.fn().mockResolvedValue(undefined),
    withExclusiveTransactionAsync: jest.fn(async (task: (connection: typeof transaction) => Promise<void>) => task(transaction)),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
  db.getFirstAsync.mockResolvedValue({ id: "settings_id" });
  // The fake intentionally implements only the SQLite methods used by the app.
  return { db, transaction, sqlite: db as unknown as SQLiteDatabase };
}
