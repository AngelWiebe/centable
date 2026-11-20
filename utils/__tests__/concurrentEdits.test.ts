import { makeIncome, testNow } from "../../test/fixtures";
import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
const income = (id: string, amount: number) => makeIncome({ id, name: id, amount });
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow());
  jest.clearAllMocks();
  useBudgetStore.setState({ incomes: [], expenses: [], budgets: [], unfundedExpenses: [] });
});
afterEach(() => jest.useRealTimers());

it("waits for an overlapping edit to commit before taking the next snapshot", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  jest.mocked(replaceAllBudgets).mockImplementationOnce(async () => { entered(); await gate; });
  const first = useBudgetStore.getState().addOrUpdateIncome(income("A", 100));
  await started;
  const second = useBudgetStore.getState().addOrUpdateIncome(income("B", 200));
  expect(replaceAllBudgets).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, second]);
  expect(useBudgetStore.getState().incomes.map(item => item.id)).toEqual(["A", "B"]);
  expect(useBudgetStore.getState().budgets.map(item => item.income.id)).toEqual(["A", "B"]);
  expect(jest.mocked(replaceAllBudgets).mock.calls[1][0].map(item => item.income.id)).toEqual(["A", "B"]);
});

it("uses the most recently committed amount as the baseline for overlapping edits to one series", async () => {
  await useBudgetStore.getState().addOrUpdateIncome(income("A", 1000));
  await Promise.all([
    useBudgetStore.getState().addOrUpdateIncome(income("A", 1500)),
    useBudgetStore.getState().addOrUpdateIncome(income("A", 2000)),
  ]);
  expect(useBudgetStore.getState().budgets[0].amount).toBe(2000);
});

it("continues processing queued edits after a failed save without including the failed edit", async () => {
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  const first = useBudgetStore.getState().addOrUpdateIncome(income("A", 100));
  const second = useBudgetStore.getState().addOrUpdateIncome(income("B", 200));
  await expect(first).rejects.toThrow("disk full");
  await second;
  expect(useBudgetStore.getState().incomes.map(item => item.id)).toEqual(["B"]);
});

it("propagates refresh failures while preserving state and allowing a later retry", async () => {
  const before = useBudgetStore.getState().budgets;
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  await expect(useBudgetStore.getState().refreshBudgets()).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(before);
  await expect(useBudgetStore.getState().refreshBudgets()).resolves.toBeUndefined();
});
