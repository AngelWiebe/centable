import { createSQLiteMock } from "../../test/sqliteMock";
import { Platform } from "react-native";
import { openDatabaseAsync } from "expo-sqlite";
import { replaceAllBudgets, setupDatabase, getUnfundedExpenses, getBudgets } from "../../database/database";
import { StoredBudget } from "../../types/budget";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

const { db: mockDB, transaction: mockTransaction, sqlite } = createSQLiteMock();
const budget: StoredBudget = {
  id: "pay|2026-11-01", date: "2026-11-01", amount: 1000, remainingBalance: 875,
  income: { id: "pay", name: "Pay", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined },
  bills: [{ id: "manual-row", amount: 125, paid: true, sort_order: 0, expense: {
    id: "manual:manual-row", name: "Groceries", amount: 125, date: new Date(2026, 10, 2, 12), frequency: undefined,
  } }],
};

describe("atomic budget replacement", () => {
  beforeAll(async () => {
    jest.mocked(openDatabaseAsync).mockResolvedValue(sqlite);
    await setupDatabase();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["ios", "web"] as const)("runs deletion and every insert in the same transaction on %s", async os => {
    jest.replaceProperty(Platform, "OS", os);
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    mockDB.runAsync.mockResolvedValue({ changes: 1 });
    await replaceAllBudgets([budget]);
    const writer = os === "web" ? mockDB : mockTransaction;
    expect(writer.runAsync.mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 3).join(" "))).toEqual([
      "DELETE FROM budget_expenses;", "DELETE FROM budgets;", "DELETE FROM unfunded_budget_expenses;", "INSERT INTO budgets", "DELETE FROM budget_expenses", "INSERT INTO budget_expenses",
    ]);
    expect(writer.runAsync).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO budget_expenses"), [
      "manual-row", budget.id, "manual:manual-row", 1, 125, 0, budget.bills[0].expense.date.toISOString(), "Groceries", 0, 0,
      1, 125, 0, budget.bills[0].expense.date.toISOString(), "Groceries", 0, 0,
    ]);
    if (os === "web") {
      expect(mockDB.withTransactionAsync).toHaveBeenCalledTimes(1);
      expect(mockDB.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    } else {
      expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
      expect(mockDB.runAsync).not.toHaveBeenCalled();
    }
  });

  it.each(["DELETE FROM budgets;", "DELETE FROM unfunded_budget_expenses;", "INSERT INTO budgets", "INSERT INTO budget_expenses"])("propagates %s failures out of the transaction so SQLite rolls back", async failedSQL => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    const failure = new Error("disk full");
    mockTransaction.runAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith(failedSQL)) throw failure;
      return { changes: 1 };
    });
    await expect(replaceAllBudgets([budget, { ...budget, id: "later" }])).rejects.toBe(failure);
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockTransaction.runAsync).not.toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(["later"]));
  });

  it("handles an empty forecast inside a transaction", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    await replaceAllBudgets([]);
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockTransaction.runAsync.mock.calls).toEqual([["DELETE FROM budget_expenses;", []], ["DELETE FROM budgets;", []], ["DELETE FROM unfunded_budget_expenses;", []]]);
  });
  it("saves unfunded occurrence metadata in the same transaction as the budgets", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const item = { id: "rent|2026-11-02", expense: { ...budget.bills[0].expense, id: "rent" }, amount: 175, paid: true, shortfall: 75 };
    await replaceAllBudgets([budget], [item]);
    expect(mockTransaction.runAsync).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO unfunded_budget_expenses"),
      [item.id, "rent", item.expense.date.toISOString(), 175, 1, 75, item.expense.name, 0]
    );
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it("aborts the transaction when saving an unfunded occurrence fails", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const error = new Error("disk full");
    mockTransaction.runAsync.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO unfunded_budget_expenses")) throw error;
      return { changes: 1 };
    });
    await expect(replaceAllBudgets([], [{ id: "rent", expense: budget.bills[0].expense, amount: 125, paid: true, shortfall: 125 }])).rejects.toBe(error);
  });

  it("restores the saved occurrence date, amount override and paid status instead of the series defaults", async () => {
    mockDB.getAllAsync.mockResolvedValue([{ id: "rent|2026-11-02", expense_id: "rent", expense_date: new Date(2026, 10, 2, 12).toISOString(), amount: 175, paid: 1, shortfall: 75 }]);
    mockDB.getFirstAsync.mockResolvedValue({ id: "rent", name: "Rent", amount: 150, date: new Date(2026, 0, 2).toISOString(), frequency: JSON.stringify({ value: 1, unit: "months" }) });
    const [item] = await getUnfundedExpenses();
    expect(item).toMatchObject({ amount: 175, paid: true, shortfall: 75, expense: { id: "rent", amount: 175, date: new Date(2026, 10, 2, 12) } });
  });

  it.each(["ios", "web"] as const)("saves a series edit and its forecast through the same transaction on %s", async os => {
    jest.replaceProperty(Platform, "OS", os);
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    mockDB.runAsync.mockResolvedValue({ changes: 1 });
    const updatedIncome = { ...budget.income, amount: 1500 };
    await replaceAllBudgets([{ ...budget, amount: 1500, remainingBalance: 1375 }], [], { income: updatedIncome });
    const writer = os === "web" ? mockDB : mockTransaction;
    expect(writer.runAsync.mock.calls[0]).toEqual([
      expect.stringContaining("INSERT INTO incomes"),
      [updatedIncome.id, updatedIncome.name, updatedIncome.date.toISOString(), 1500, null],
    ]);
    expect(writer.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO budgets"), expect.arrayContaining([1500, 1375]));
    if (os === "ios") expect(mockDB.runAsync).not.toHaveBeenCalled();
  });

  it("saves expense series fields through the forecast transaction", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const expense = { id: "rent", name: "Rent", amount: 600, date: new Date(2026, 10, 2), frequency: { value: 1, unit: "months" as const } };
    await replaceAllBudgets([budget], [], { expense });
    expect(mockTransaction.runAsync.mock.calls[0]).toEqual([
      expect.stringContaining("INSERT INTO expenses"),
      ["rent", "Rent", expense.date.toISOString(), 600, JSON.stringify(expense.frequency)],
    ]);
  });

  it.each(["income", "expense"] as const)("aborts the shared transaction if a forecast write fails after the %s edit", async kind => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    const failure = new Error("disk full");
    mockTransaction.runAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT INTO budget_expenses")) throw failure;
      return { changes: 1 };
    });
    const change = kind === "income" ? { income: budget.income } : { expense: budget.bills[0].expense };
    await expect(replaceAllBudgets([budget], [], change)).rejects.toBe(failure);
    expect(mockTransaction.runAsync.mock.calls[0][0]).toContain(kind === "income" ? "INSERT INTO incomes" : "INSERT INTO expenses");
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDB.runAsync).not.toHaveBeenCalled();
  });

  it("saves an explicit assignment flag when replacing the forecast", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const movedBudget = { ...budget, bills: [{ ...budget.bills[0], assignmentOverride: true }] };
    await replaceAllBudgets([movedBudget]);
    const insert = mockTransaction.runAsync.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO budget_expenses"))!;
    expect(insert[0]).toContain("assignment_override");
    expect(insert[1][8]).toBe(1);
    expect(insert[1][15]).toBe(1);
  });

  it("restores the manual assignment flag when loading budgets", async () => {
    mockDB.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT * FROM budgets")) return [{ id: budget.id, date: budget.date, income_id: "pay", amount: 1000, remaining_balance: 875 }];
      return [{ id: "moved", expense_id: "rent", amount: 125, paid: 1, sort_order: 0, expense_date: new Date(2026, 10, 2, 12).toISOString(), assignment_override: 1 }];
    });
    mockDB.getFirstAsync.mockImplementation(async (sql: string) => sql.includes("FROM incomes")
      ? { id: "pay", name: "Pay", amount: 1000, date: new Date(2026, 10, 1).toISOString(), frequency: null }
      : { id: "rent", name: "Rent", amount: 125, date: new Date(2026, 0, 2).toISOString(), frequency: null });
    const budgets = await getBudgets();
    expect(budgets[0].bills[0]).toMatchObject({ id: "moved", assignmentOverride: true, paid: true, expense: { date: new Date(2026, 10, 2, 12) } });
  });

  it("propagates budget read failures instead of reporting an empty database", async () => {
    const failure = new Error("temporary read failure");
    mockDB.getAllAsync.mockRejectedValueOnce(failure);
    await expect(getBudgets()).rejects.toBe(failure);
  });

  it("restores an orphaned manual expense without needing a source expense record", async () => {
    mockDB.getAllAsync.mockResolvedValue([{ id: "coffee", expense_id: "manual:coffee", expense_date: new Date(2026, 10, 3, 12).toISOString(), amount: 25, paid: 1, shortfall: 25, name: "Coffee", amount_override: 1 }]);
    mockDB.getFirstAsync.mockResolvedValue(null);
    expect(await getUnfundedExpenses()).toEqual([expect.objectContaining({
      id: "coffee", amount: 25, paid: true, amountOverride: true,
      expense: expect.objectContaining({ id: "manual:coffee", name: "Coffee", date: new Date(2026, 10, 3, 12) }),
    })]);
  });

  it("persists explicit income and expense amount overrides even when the amounts equal their series", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const explicit = { ...budget, amountOverride: true, bills: [{ ...budget.bills[0], amountOverride: true }] };
    await replaceAllBudgets([explicit]);
    const incomeInsert = mockTransaction.runAsync.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO budgets"))!;
    const expenseInsert = mockTransaction.runAsync.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO budget_expenses"))!;
    expect(incomeInsert[1][5]).toBe(1);
    expect(expenseInsert[1][9]).toBe(1);
    expect(expenseInsert[1][16]).toBe(1);

    mockDB.getAllAsync.mockImplementation(async (sql: string) => sql.startsWith("SELECT * FROM budgets")
      ? [{ id: budget.id, date: budget.date, income_id: "pay", amount: 1000, remaining_balance: 875, amount_override: 1 }]
      : [{ id: "rent-row", expense_id: "rent", amount: 125, paid: 1, sort_order: 0, expense_date: new Date(2026, 10, 2, 12).toISOString(), amount_override: 1 }]);
    mockDB.getFirstAsync.mockImplementation(async (sql: string) => sql.includes("FROM incomes")
      ? { id: "pay", name: "Pay", amount: 1000, date: budget.date, frequency: null }
      : { id: "rent", name: "Rent", amount: 125, date: budget.date, frequency: null });
    const [loaded] = await getBudgets();
    expect(loaded.amountOverride).toBe(true);
    expect(loaded.bills[0].amountOverride).toBe(true);
  });

  it.each(["income", "expense"] as const)("keeps a %s deletion inside the forecast transaction and propagates a later failure", async kind => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    const error = new Error("disk full");
    mockTransaction.runAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT INTO budgets")) throw error;
      return { changes: 1 };
    });
    const change = kind === "income" ? { deleteIncomeId: "old" } : { deleteExpenseId: "old" };
    await expect(replaceAllBudgets([budget], [], change)).rejects.toBe(error);
    const queries = mockTransaction.runAsync.mock.calls.map(([sql]) => sql);
    expect(queries.indexOf(`DELETE FROM ${kind === "income" ? "incomes" : "expenses"} WHERE id = ?;`)).toBeGreaterThan(queries.indexOf("DELETE FROM budget_expenses;"));
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDB.runAsync).not.toHaveBeenCalled();
  });

  it("does not open a write transaction when the persisted forecast is unchanged", async () => {
    jest.clearAllMocks();
    await replaceAllBudgets([budget], [], undefined, { budgets: [budget], unfundedExpenses: [] });
    expect(mockDB.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(mockDB.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockTransaction.runAsync).not.toHaveBeenCalled();
  });

  it("writes only a changed budget while retaining a large unchanged history", async () => {
    jest.replaceProperty(Platform, "OS", "ios"); jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const history = Array.from({ length: 1000 }, (_, index) => ({ ...budget, id: `budget-${index}`, bills: [] }));
    const changed = history.map((item, index) => index === 999 ? { ...item, amount: 1500, remainingBalance: 1500, amountOverride: true } : item);
    await replaceAllBudgets(changed, [], undefined, { budgets: history, unfundedExpenses: [] });
    expect(mockTransaction.runAsync.mock.calls).toHaveLength(2);
    expect(mockTransaction.runAsync).toHaveBeenCalledWith("DELETE FROM budget_expenses WHERE budget_id = ?;", ["budget-999"]);
    expect(mockTransaction.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO budgets"), expect.arrayContaining(["budget-999"]));
    expect(mockTransaction.runAsync).not.toHaveBeenCalledWith("DELETE FROM budgets;", []);
  });

  it("clears both changed assignments before inserting a moved row with a stable ID", async () => {
    jest.replaceProperty(Platform, "OS", "ios"); jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const other = { ...budget, id: "other", bills: [], remainingBalance: 1000 };
    const previous = { budgets: [budget, other], unfundedExpenses: [] };
    const next = [{ ...budget, bills: [], remainingBalance: 1000 }, { ...other, bills: budget.bills, remainingBalance: 875 }];
    await replaceAllBudgets(next, [], undefined, previous);
    expect(mockTransaction.runAsync.mock.calls.slice(0, 2)).toEqual([
      ["DELETE FROM budget_expenses WHERE budget_id = ?;", [budget.id]],
      ["DELETE FROM budget_expenses WHERE budget_id = ?;", ["other"]],
    ]);
    expect(mockTransaction.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO budget_expenses"), expect.arrayContaining(["manual-row", "other"]));
  });

  it("persists source-only edits without rewriting unchanged forecast rows", async () => {
    jest.replaceProperty(Platform, "OS", "ios"); jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    await replaceAllBudgets([budget], [], { income: { ...budget.income, name: "Updated name" } }, { budgets: [budget], unfundedExpenses: [] });
    expect(mockTransaction.runAsync).toHaveBeenCalledTimes(1);
    expect(mockTransaction.runAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO incomes"), expect.arrayContaining(["Updated name"]));
  });

  it("removes a deleted income's old budget before deleting the source in a differential save", async () => {
    jest.replaceProperty(Platform, "OS", "ios"); jest.clearAllMocks();
    mockTransaction.runAsync.mockResolvedValue({ changes: 1 });
    const manual = { id: "manual-row", amount: 125, paid: true, shortfall: 125, expense: budget.bills[0].expense };
    await replaceAllBudgets([], [manual], { deleteIncomeId: "pay" }, { budgets: [budget], unfundedExpenses: [] });
    expect(mockTransaction.runAsync.mock.calls.slice(0, 3)).toEqual([
      ["DELETE FROM budget_expenses WHERE budget_id = ?;", [budget.id]],
      ["DELETE FROM budgets WHERE id = ?;", [budget.id]],
      ["DELETE FROM incomes WHERE id = ?;", ["pay"]],
    ]);
    expect(mockTransaction.runAsync).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO unfunded_budget_expenses"), expect.arrayContaining(["manual-row"]));
  });

  it("clears obsolete unfunded rows and aborts if a later differential budget write fails", async () => {
    jest.replaceProperty(Platform, "OS", "ios"); jest.clearAllMocks();
    const error = new Error("disk full");
    mockTransaction.runAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT INTO budgets")) throw error;
      return { changes: 1 };
    });
    const oldUnfunded = { id: "manual-row", amount: 125, paid: true, shortfall: 125, expense: budget.bills[0].expense };
    await expect(replaceAllBudgets([budget], [], undefined, { budgets: [], unfundedExpenses: [oldUnfunded] })).rejects.toBe(error);
    expect(mockTransaction.runAsync).toHaveBeenCalledWith("DELETE FROM unfunded_budget_expenses WHERE id = ?;", ["manual-row"]);
    expect(mockDB.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

});
