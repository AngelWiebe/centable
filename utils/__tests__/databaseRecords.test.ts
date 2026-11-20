import { openDatabaseAsync } from "expo-sqlite";
import { createSQLiteMock } from "../../test/sqliteMock";
import { setupDatabase, getBudgets, getUnfundedExpenses, getIncomes, getExpenses, getSettings, updateCurrency, updateTheme } from "../../database/database";
import { migrateDatabase } from "../../database/migrations";
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
const { db, sqlite } = createSQLiteMock();
const day = new Date(2026, 10, 2, 12).toISOString();
const income = { id: "pay", name: "Pay", date: day, amount: 1000, frequency: JSON.stringify({ unit: "months", value: 1 }) };
const expense = { id: "rent", name: "Rent", date: day, amount: 100, frequency: null };
beforeAll(async () => { jest.mocked(openDatabaseAsync).mockResolvedValue(sqlite); await setupDatabase(); });
beforeEach(() => { jest.clearAllMocks(); db.getAllAsync.mockReset().mockResolvedValue([]); db.getFirstAsync.mockReset().mockResolvedValue(null); db.runAsync.mockReset().mockResolvedValue({ changes: 1 }); });
it("restores source dates and recurring frequencies from saved records", async () => {
  db.getAllAsync.mockResolvedValueOnce([income]).mockResolvedValueOnce([expense]);
  expect(await getIncomes()).toEqual([{ ...income, date: new Date(day), frequency: { unit: "months", value: 1 } }]);
  expect(await getExpenses()).toEqual([{ ...expense, date: new Date(day), frequency: undefined }]);
});
it("hydrates saved occurrence overrides and derives balances from surviving bills", async () => {
  db.getAllAsync.mockImplementation(async sql => sql.includes("budget_expenses WHERE") ? [
    { id: "rent-row", expense_id: "rent", amount: 120.5, paid: 1, sort_order: 0, assignment_override: 1, amount_override: 1 },
    { id: "manual-row", expense_id: "manual:coffee", name: "Coffee", expense_date: day, amount: 10.25, paid: 0, sort_order: 1 },
    { id: "deleted-row", expense_id: "deleted", expense_date: day, amount: 800, paid: 0, sort_order: 2 },
  ] : [{ id: "budget", date: day, income_id: "pay", amount: 900, remaining_balance: -99, amount_override: 1 }]);
  db.getFirstAsync.mockImplementation(async (sql, args) => sql.includes("incomes") ? income : args[0] === "rent" ? expense : null);
  const [budget] = await getBudgets();
  expect(budget).toMatchObject({ amount: 900, remainingBalance: 769.25, amountOverride: true, income: { amount: 900 } });
  expect(budget.bills).toHaveLength(2);
  expect(budget.bills[0]).toMatchObject({ paid: true, assignmentOverride: true, amountOverride: true, expense: { amount: 120.5, date: new Date(day) } });
  expect(budget.bills[1].expense).toMatchObject({ name: "Coffee", date: new Date(day), frequency: undefined });
});
it("skips budgets whose income no longer exists", async () => {
  db.getAllAsync.mockResolvedValueOnce([{ id: "budget", income_id: "deleted" }]);
  expect(await getBudgets()).toEqual([]);
});
it("restores manual unfunded entries and skips missing generated sources", async () => {
  db.getAllAsync.mockResolvedValueOnce([
    { id: "manual", expense_id: "manual:coffee", expense_date: day, amount: 10, shortfall: 10, paid: 1, amount_override: 1, name: "Coffee" },
    { id: "removed", expense_id: "deleted", expense_date: day, amount: 100, shortfall: 100, paid: 0 },
  ]);
  expect(await getUnfundedExpenses()).toEqual([expect.objectContaining({ id: "manual", paid: true, amountOverride: true, expense: expect.objectContaining({ name: "Coffee", date: new Date(day) }) })]);
});
it.each([null, { currency: "EUR", theme: "light" }])("loads settings with a safe first-run fallback for %s", async saved => {
  db.getFirstAsync.mockResolvedValueOnce(saved);
  expect(await getSettings()).toEqual(saved ?? { currency: "CAD", theme: "dark" });
});
it("changes currency without replacing the saved theme", async () => {
  db.getFirstAsync.mockResolvedValueOnce({ theme: "light" });
  await updateCurrency("JPY");
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("DO UPDATE SET currency = excluded.currency"), ["settings_id", "JPY", "light"]);
});
it("changes theme without replacing the saved currency", async () => {
  db.getFirstAsync.mockResolvedValueOnce({ currency: "EUR" });
  await updateTheme("light");
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("DO UPDATE SET theme = excluded.theme"), ["settings_id", "EUR", "light"]);
});
it("initializes first-run settings during migration", async () => {
  await migrateDatabase(sqlite);
  expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO settings"), ["settings_id", "CAD", "dark"]);
});
