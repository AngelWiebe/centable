import { makeIncome, makeExpense, testNow } from "../../test/fixtures";
import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
const income = (id: string, amount: number, day = 1) => makeIncome({ id, name: id, amount, date: new Date(2026, 10, day) });
const expense = (id: string, amount: number, day = 12) => makeExpense({ id, name: id, amount, date: new Date(2026, 10, day) });
function seed(incomes = [income("pay", 500)], expenses = [expense("rent", 400)]) {
  const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 9, 1), new Date(2027, 1, 28));
  useBudgetStore.setState({ incomes, expenses, ...forecast });
  return forecast;
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow());
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

it("immediately funds an unaffordable bill after increasing an income occurrence", async () => {
  const before = seed([income("pay", 100)], [expense("rent", 150)]);
  await useBudgetStore.getState().updateIncomeAmount(before.budgets[0].id, 200);
  expect(useBudgetStore.getState().unfundedExpenses).toEqual([]);
  expect(useBudgetStore.getState().budgets[0].bills[0].amount).toBe(150);
  expect(useBudgetStore.getState().budgets[0].remainingBalance).toBe(50);
  expect(useBudgetStore.getState().incomes[0].amount).toBe(100);
});

it("reassigns automatic bills after decreasing income and retains payment", async () => {
  const before = seed([income("early", 1000), income("later", 500, 10)]);
  before.budgets[1].bills[0].paid = true;
  await useBudgetStore.getState().updateIncomeAmount(before.budgets[1].id, 300);
  const [early, later] = useBudgetStore.getState().budgets;
  expect(early.bills[0]).toMatchObject({ amount: 400, paid: true });
  expect(later.bills).toEqual([]);
  expect(later.remainingBalance).toBe(300);
});

it("reassigns an increased expense occurrence to earlier income", async () => {
  const before = seed([income("early", 1000), income("later", 500, 10)]);
  const later = before.budgets[1];
  await useBudgetStore.getState().updateExpenseAmount(later.id, later.bills[0].id, 600);
  expect(useBudgetStore.getState().budgets[0].bills[0].amount).toBe(600);
  expect(useBudgetStore.getState().budgets[1].bills).toEqual([]);
});

it("uses funds freed by a reduced expense to assign previously unfunded bills", async () => {
  const before = seed([income("pay", 500)], [expense("first", 400, 11), expense("second", 200)]);
  await useBudgetStore.getState().updateExpenseAmount(before.budgets[0].id, before.budgets[0].bills[0].id, 100);
  expect(useBudgetStore.getState().unfundedExpenses).toEqual([]);
  expect(useBudgetStore.getState().budgets[0].remainingBalance).toBe(200);
});

it.each(["income", "expense"] as const)("keeps the entire forecast unchanged when an occurrence %s edit cannot commit", async kind => {
  const before = seed();
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  const action = kind === "income"
    ? useBudgetStore.getState().updateIncomeAmount(before.budgets[0].id, 300)
    : useBudgetStore.getState().updateExpenseAmount(before.budgets[0].id, before.budgets[0].bills[0].id, 600);
  await expect(action).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
  expect(useBudgetStore.getState().unfundedExpenses).toBe(before.unfundedExpenses);
});
