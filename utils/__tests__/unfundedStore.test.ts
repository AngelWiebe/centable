import useBudgetStore from "../../store/useBudgetStore";
import { getBudgets, getUnfundedExpenses, replaceAllBudgets } from "../../database/database";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  getIncomes: jest.fn().mockResolvedValue([]),
  getExpenses: jest.fn().mockResolvedValue([{ id: "rent", name: "Rent", amount: 150, date: new Date(2026, 10, 2), frequency: undefined }]),
  getSettings: jest.fn().mockResolvedValue({ currency: "CAD", theme: "dark" }),
  getBudgets: jest.fn().mockResolvedValue([]),
  getUnfundedExpenses: jest.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 17, 12));
  jest.clearAllMocks();
  useBudgetStore.setState({ incomes: [], expenses: [], budgets: [], unfundedExpenses: [] });
});
afterEach(() => jest.useRealTimers());

it("restores unfunded overrides and payment details on app reload and saves the resulting forecast", async () => {
  const item = { id: "rent|2026-11-02", amount: 175, paid: true, shortfall: 175, expense: { id: "rent", name: "Rent", amount: 175, date: new Date(2026, 10, 2, 12), frequency: undefined } };
  jest.mocked(getUnfundedExpenses).mockResolvedValueOnce([item]);
  await useBudgetStore.getState().fetchAndCleanBudgets();
  expect(getBudgets).toHaveBeenCalled();
  expect(getUnfundedExpenses).toHaveBeenCalled();
  expect(useBudgetStore.getState().unfundedExpenses).toEqual([{ ...item, amountOverride: true }]);
  expect(replaceAllBudgets).toHaveBeenCalledWith([], [{ ...item, amountOverride: true }], undefined, expect.anything());
});

it("does not replace in-memory unfunded details if saving the replacement fails", async () => {
  const before = [{ id: "rent|2026-11-02", amount: 175, paid: true, shortfall: 175, expense: { id: "rent", name: "Rent", amount: 175, date: new Date(2026, 10, 2, 12), frequency: undefined } }];
  useBudgetStore.setState({ expenses: [{ ...before[0].expense, amount: 150 }], unfundedExpenses: before });
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  await expect(useBudgetStore.getState().refreshBudgets()).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().unfundedExpenses).toBe(before);
});


it("does not rebuild or replace existing state after a budget read fails on load", async () => {
  const before = useBudgetStore.getState();
  jest.mocked(getBudgets).mockRejectedValueOnce(new Error("read failed"));
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(before.fetchAndCleanBudgets()).rejects.toThrow("read failed");
    expect(replaceAllBudgets).not.toHaveBeenCalled();
    expect(useBudgetStore.getState().budgets).toBe(before.budgets);
    expect(useBudgetStore.getState().unfundedExpenses).toBe(before.unfundedExpenses);
    expect(useBudgetStore.getState().loading).toBe(false);
  } finally {
    errorLog.mockRestore();
  }
});
