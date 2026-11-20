import { makeIncome, makeExpense, testNow } from "../../test/fixtures";
import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets, getIncomes, getExpenses, getBudgets, getUnfundedExpenses } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";
import { IncomeInterface } from "../../types/income";
import { ExpenseInterface } from "../../types/expense";
import { BudgetForecast } from "../../types/budget";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  getSettings: jest.fn().mockResolvedValue({ currency: "CAD", theme: "dark" }),
  replaceAllBudgets: jest.fn(), getIncomes: jest.fn(), getExpenses: jest.fn(), getBudgets: jest.fn(), getUnfundedExpenses: jest.fn(),
}));

let savedIncomes: IncomeInterface[];
let savedExpenses: ExpenseInterface[];
let savedForecast: BudgetForecast;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow(12));
  jest.clearAllMocks();
  savedIncomes = [makeIncome()];
  savedExpenses = [makeExpense({ amount: 400 })];
  savedForecast = buildBudgetForecast(savedIncomes, savedExpenses, new Date(2026, 9, 1), new Date(2027, 1, 28));
  useBudgetStore.setState({ incomes: savedIncomes, expenses: savedExpenses, ...savedForecast });
  jest.mocked(getIncomes).mockImplementation(async () => savedIncomes);
  jest.mocked(getExpenses).mockImplementation(async () => savedExpenses);
  jest.mocked(getBudgets).mockImplementation(async () => savedForecast.budgets);
  jest.mocked(getUnfundedExpenses).mockImplementation(async () => savedForecast.unfundedExpenses);
  jest.mocked(replaceAllBudgets).mockImplementation(async (budgets, unfundedExpenses = [], change) => {
    if (change?.income) savedIncomes = [change.income];
    if (change?.expense) savedExpenses = [change.expense];
    savedForecast = { budgets, unfundedExpenses };
  });
});
afterEach(() => jest.useRealTimers());

it.each(["income", "expense"] as const)("keeps a failed %s edit unapplied across reload, then applies it correctly on retry", async kind => {
  const before = useBudgetStore.getState();
  const edit = () => kind === "income"
    ? useBudgetStore.getState().addOrUpdateIncome({ ...savedIncomes[0], amount: 1500 })
    : useBudgetStore.getState().addOrUpdateExpense({ ...savedExpenses[0], amount: 600 });
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  await expect(edit()).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().incomes).toBe(before.incomes);
  expect(useBudgetStore.getState().expenses).toBe(before.expenses);
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
  expect(savedIncomes[0].amount).toBe(1000);
  expect(savedExpenses[0].amount).toBe(400);

  await useBudgetStore.getState().fetchAndCleanBudgets();
  await edit();
  await useBudgetStore.getState().fetchAndCleanBudgets();
  const [budget] = useBudgetStore.getState().budgets;
  expect(budget.amount).toBe(kind === "income" ? 1500 : 1000);
  expect(budget.bills[0].amount).toBe(kind === "expense" ? 600 : 400);
  expect(budget.remainingBalance).toBe(kind === "income" ? 1100 : 400);
});

it("preserves real occurrence overrides and paid status when an income series edit commits", async () => {
  savedForecast.budgets[0].amount = 1200;
  savedForecast.budgets[0].income.amount = 1200;
  savedForecast.budgets[0].bills[0].amount = 450;
  savedForecast.budgets[0].bills[0].paid = true;
  await useBudgetStore.getState().addOrUpdateIncome({ ...savedIncomes[0], amount: 1500 });
  const [budget] = useBudgetStore.getState().budgets;
  expect(budget.amount).toBe(1200);
  expect(budget.bills[0]).toMatchObject({ amount: 450, paid: true });
  expect(savedIncomes[0].amount).toBe(1500);
  expect(replaceAllBudgets).toHaveBeenLastCalledWith(expect.any(Array), [], { income: expect.objectContaining({ amount: 1500 }) }, expect.anything());
});

it.each(["income", "expense"] as const)("does not publish a new %s when its forecast save fails", async kind => {
  const before = useBudgetStore.getState();
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  const action = kind === "income"
    ? before.addOrUpdateIncome({ ...savedIncomes[0], id: "new-income" })
    : before.addOrUpdateExpense({ ...savedExpenses[0], id: "new-expense" });
  await expect(action).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().incomes).toBe(before.incomes);
  expect(useBudgetStore.getState().expenses).toBe(before.expenses);
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
});
