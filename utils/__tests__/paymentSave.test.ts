import { makeIncome, makeExpense } from "../../test/fixtures";
import useBudgetStore from "../../store/useBudgetStore";
import { setPaidStatusInDB } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  setPaidStatusInDB: jest.fn().mockResolvedValue(undefined),
}));
const income = makeIncome({ amount: 500 });
const expense = makeExpense();
let budgetId: string;
let rowId: string;
beforeEach(() => {
  jest.clearAllMocks();
  const forecast = buildBudgetForecast([income], [expense], new Date(2026, 10, 1), new Date(2026, 10, 30));
  useBudgetStore.setState({ incomes: [income], expenses: [expense], ...forecast });
  budgetId = forecast.budgets[0].id;
  rowId = forecast.budgets[0].bills[0].id;
});

it("keeps the previous state when saving payment fails", async () => {
  const before = useBudgetStore.getState().budgets;
  jest.mocked(setPaidStatusInDB).mockRejectedValueOnce(new Error("disk full"));
  await expect(useBudgetStore.getState().toggleExpensePaid(budgetId, rowId, true)).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(before);
  expect(before[0].bills[0].paid).toBe(false);
});

it("publishes payment success only after the database write completes", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  jest.mocked(setPaidStatusInDB).mockImplementationOnce(async () => { entered(); await gate; });
  const save = useBudgetStore.getState().toggleExpensePaid(budgetId, rowId, true);
  await started;
  expect(useBudgetStore.getState().budgets[0].bills[0].paid).toBe(false);
  release();
  await save;
  expect(useBudgetStore.getState().budgets[0].bills[0].paid).toBe(true);
});

it("serializes successive payment updates", async () => {
  await Promise.all([
    useBudgetStore.getState().toggleExpensePaid(budgetId, rowId, true),
    useBudgetStore.getState().toggleExpensePaid(budgetId, rowId, false),
  ]);
  expect(jest.mocked(setPaidStatusInDB).mock.calls).toEqual([[budgetId, rowId, true], [budgetId, rowId, false]]);
  expect(useBudgetStore.getState().budgets[0].bills[0].paid).toBe(false);
});


it("rejects a stale occurrence without issuing a write", async () => {
  await expect(useBudgetStore.getState().toggleExpensePaid(budgetId, "missing", true)).rejects.toThrow("not found");
  expect(setPaidStatusInDB).not.toHaveBeenCalled();
});
