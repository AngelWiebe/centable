import useBudgetStore from "../../store/useBudgetStore";
import { getIncomes, getExpenses, replaceAllBudgets } from "../../database/database";
import { makeIncome, testNow } from "../../test/fixtures";
jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getIncomes: jest.fn(), getExpenses: jest.fn().mockResolvedValue([]), getBudgets: jest.fn().mockResolvedValue([]),
  getUnfundedExpenses: jest.fn().mockResolvedValue([]), getSettings: jest.fn().mockResolvedValue({ currency: "CAD", theme: "dark" }),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]), replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow()); jest.clearAllMocks();
  useBudgetStore.setState({ incomes: [], expenses: [], budgets: [], unfundedExpenses: [], loadError: null });
  jest.mocked(getIncomes).mockResolvedValue([makeIncome()]);
});
afterEach(() => jest.useRealTimers());
it("reloads saved sources on refresh after a startup read failure", async () => {
  jest.mocked(getIncomes).mockRejectedValueOnce(new Error("database unavailable"));
  await expect(useBudgetStore.getState().fetchAndCleanBudgets()).rejects.toThrow("database unavailable");
  expect(useBudgetStore.getState().loadError).toContain("Refresh");
  expect(useBudgetStore.getState().loading).toBe(false);
  expect(replaceAllBudgets).not.toHaveBeenCalled();
  await useBudgetStore.getState().refreshBudgets();
  expect(getIncomes).toHaveBeenCalledTimes(2);
  expect(useBudgetStore.getState().incomes).toHaveLength(1);
  expect(useBudgetStore.getState().budgets[0].amount).toBe(1000);
  expect(useBudgetStore.getState().loadError).toBeNull();
});
it("keeps the retry error visible if loading fails again", async () => {
  jest.mocked(getIncomes).mockRejectedValue(new Error("still unavailable"));
  await expect(useBudgetStore.getState().fetchAndCleanBudgets()).rejects.toThrow();
  await expect(useBudgetStore.getState().refreshBudgets()).rejects.toThrow();
  expect(useBudgetStore.getState().loadError).not.toBeNull();
  expect(replaceAllBudgets).not.toHaveBeenCalled();
});

it("propagates expense read failures and permits a successful retry", async () => {
  jest.mocked(getExpenses).mockRejectedValueOnce(new Error("read failed"));
  await expect(useBudgetStore.getState().getExpenses()).rejects.toThrow("read failed");
  await expect(useBudgetStore.getState().getExpenses()).resolves.toBeUndefined();
});
