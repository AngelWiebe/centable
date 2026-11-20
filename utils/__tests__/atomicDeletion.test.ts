import { makeIncome, makeExpense, testNow } from "../../test/fixtures";
import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";
jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined), getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow());
  jest.clearAllMocks();
  const incomes = [makeIncome()];
  const expenses = [makeExpense()];
  useBudgetStore.setState({ incomes, expenses, ...buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2026, 10, 30)) });
});
afterEach(() => jest.useRealTimers());
it.each(["income", "expense"] as const)("keeps the source record and forecast unchanged if a %s deletion fails", async kind => {
  const before = useBudgetStore.getState();
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  const action = kind === "income" ? before.deleteIncome("pay") : before.deleteExpense("rent");
  await expect(action).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().incomes).toBe(before.incomes);
  expect(useBudgetStore.getState().expenses).toBe(before.expenses);
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
});
it("publishes source deletion and reallocated expenses together after commit", async () => {
  await useBudgetStore.getState().deleteIncome("pay");
  expect(useBudgetStore.getState().incomes).toEqual([]);
  expect(useBudgetStore.getState().budgets).toEqual([]);
  expect(useBudgetStore.getState().unfundedExpenses[0].expense.id).toBe("rent");
  expect(replaceAllBudgets).toHaveBeenLastCalledWith([], expect.any(Array), { deleteIncomeId: "pay" }, expect.anything());
});
it("removes a deleted expense from the same committed forecast", async () => {
  await useBudgetStore.getState().deleteExpense("rent");
  expect(useBudgetStore.getState().expenses).toEqual([]);
  expect(useBudgetStore.getState().budgets[0].bills).toEqual([]);
});
