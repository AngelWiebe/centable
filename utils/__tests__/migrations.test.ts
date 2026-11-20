jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
beforeEach(() => { jest.resetModules(); });
async function fixture() {
  const columns: Record<string, Set<string>> = {
    budgets: new Set(), budget_expenses: new Set(["expense_date"]), unfunded_budget_expenses: new Set(),
  };
  const db = {
    execAsync: jest.fn(async (sql: string) => {
      const match = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/);
      if (match) {
        if (columns[match[1]].has(match[2])) throw new Error("duplicate column");
        columns[match[1]].add(match[2]);
      }
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      const table = sql.match(/table_info\((\w+)\)/)![1];
      return [...columns[table]].map(name => ({ name }));
    }),
    getFirstAsync: jest.fn().mockResolvedValue({ id: "settings_id" }),
  };
  const sqlite = jest.requireMock("expo-sqlite") as typeof import("expo-sqlite");
  jest.mocked(sqlite.openDatabaseAsync).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof sqlite.openDatabaseAsync>>);
  const { setupDatabase } = jest.requireActual<typeof import("../../database/database")>("../../database/database");
  return { db, columns, setupDatabase, open: sqlite.openDatabaseAsync };
}
it("adds only missing columns and skips already installed columns", async () => {
  const { db, columns, setupDatabase } = await fixture();
  await setupDatabase();
  expect(columns.budgets.has("amount_override")).toBe(true);
  expect(columns.budget_expenses.has("assignment_override")).toBe(true);
  expect(columns.unfunded_budget_expenses.has("name")).toBe(true);
  expect(db.execAsync.mock.calls.some(([sql]) => sql.includes("ADD COLUMN expense_date"))).toBe(false);
});
it("propagates migration write errors and safely retries a partial migration", async () => {
  const { db, setupDatabase, open, columns } = await fixture();
  const original = db.execAsync.getMockImplementation()!;
  const failure = new Error("database is locked");
  let fail = true;
  db.execAsync.mockImplementation(async sql => {
    if (fail && sql.includes("ADD COLUMN assignment_override")) { fail = false; throw failure; }
    return original(sql);
  });
  await expect(setupDatabase()).rejects.toBe(failure);
  expect(columns.budgets.has("amount_override")).toBe(true);
  await expect(setupDatabase()).resolves.toBeUndefined();
  expect(open).toHaveBeenCalledTimes(2);
  expect(columns.budget_expenses.has("assignment_override")).toBe(true);
});
it("propagates schema-read failures rather than treating the database as ready", async () => {
  const { db, setupDatabase } = await fixture();
  db.getAllAsync.mockRejectedValueOnce(new Error("schema read failed"));
  await expect(setupDatabase()).rejects.toThrow("schema read failed");
  await expect(setupDatabase()).resolves.toBeUndefined();
});
