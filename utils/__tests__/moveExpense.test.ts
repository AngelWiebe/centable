import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";
import { makeIncome, makeExpense, testNow } from "../../test/fixtures";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
function budgets() {
  const all = useBudgetStore.getState().budgets;
  return {
    source: all.find(item => item.income.id === "source")!,
    destination: all.find(item => item.income.id === "destination")!,
    unrelated: all.find(item => item.income.id === "unrelated")!,
  };
}
function seed(overrides: Partial<{ source: number; destination: number; moved: number; kept: number; existing: number }> = {}) {
  const amounts = { source: 1000, destination: 600, moved: 125.5, kept: 80, existing: 50, ...overrides };
  const incomes = [
    makeIncome({ id: "destination", amount: amounts.destination }),
    makeIncome({ id: "source", amount: amounts.source, date: new Date(2026, 10, 2) }),
    makeIncome({ id: "unrelated", amount: 200, date: new Date(2026, 10, 4) }),
  ];
  const expenses = [makeExpense({ amount: amounts.moved, date: new Date(2026, 10, 3, 12) })];
  const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2027, 1, 28));
  useBudgetStore.setState({ incomes, expenses, ...forecast, loadError: null });
  const { source, destination } = budgets();
  for (const [budget, id, amount] of [[source, "kept", amounts.kept], [destination, "existing", amounts.existing]] as const) {
    budget.bills.push({ id, amount, paid: false, sort_order: budget.bills.length, expense: makeExpense({ id: `manual:${id}`, name: id, amount, date: new Date(2026, 10, 3, 12) }) });
    budget.remainingBalance -= amount;
  }
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(testNow()); jest.clearAllMocks(); seed();
});
afterEach(() => jest.useRealTimers());

it("recalculates both balances and retains unrelated budget contents", async () => {
  const { source, destination, unrelated } = budgets();
  const moved = source.bills.find(bill => bill.expense.id === "rent")!;
  await useBudgetStore.getState().moveExpenseBetweenBudgets(source.id, destination.id, "rent", moved.id, moved.amount);
  const updated = budgets();
  expect(updated.source.bills.map(bill => bill.id)).toEqual(["kept"]);
  expect(updated.source.remainingBalance).toBe(920);
  expect(updated.destination.bills.map(bill => bill.amount)).toEqual([50, 125.5]);
  expect(updated.destination.remainingBalance).toBe(424.5);
  expect(updated.unrelated).toEqual(unrelated);
  expect(replaceAllBudgets).toHaveBeenCalledTimes(1);
});
it("preserves the entire forecast when the atomic move save fails", async () => {
  const before = useBudgetStore.getState();
  const { source, destination } = budgets();
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("write failed"));
  const moved = source.bills.find(bill => bill.expense.id === "rent")!;
  await expect(before.moveExpenseBetweenBudgets(source.id, destination.id, "rent", moved.id, moved.amount)).rejects.toThrow("write failed");
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
  expect(useBudgetStore.getState().unfundedExpenses).toBe(before.unfundedExpenses);
});
it("keeps cent-accurate balances after a move", async () => {
  seed({ source: 100, destination: 0.3, moved: 0.1, kept: 99.9, existing: 0.2 });
  const { source, destination } = budgets();
  const moved = source.bills.find(bill => bill.expense.id === "rent")!;
  await useBudgetStore.getState().moveExpenseBetweenBudgets(source.id, destination.id, "rent", moved.id, 0.1);
  expect(budgets().source.remainingBalance).toBe(0.1);
  expect(budgets().destination.remainingBalance).toBe(0);
});
it.each(["rent", "manual:coffee"])("preserves occurrence details for %s", async expenseId => {
  const { source, destination } = budgets();
  const old = source.bills.find(bill => bill.expense.id === "rent")!;
  const occurrence = { ...old, paid: true, expense: { ...old.expense, id: expenseId, name: expenseId === "rent" ? "Rent" : "Coffee" } };
  source.bills = source.bills.map(bill => bill.id === old.id ? occurrence : bill);
  if (expenseId.startsWith("manual:")) useBudgetStore.setState({ expenses: [] });
  await useBudgetStore.getState().moveExpenseBetweenBudgets(source.id, destination.id, expenseId, occurrence.id, occurrence.amount);
  const moved = budgets().destination.bills.find(bill => bill.id === occurrence.id)!;
  expect(moved).toMatchObject({ paid: true, assignmentOverride: true, amount: occurrence.amount });
  expect(moved.expense).toMatchObject({ id: expenseId, name: occurrence.expense.name, date: occurrence.expense.date });
});
it("does nothing when moving to the same budget", async () => {
  const { source } = budgets();
  const before = useBudgetStore.getState().budgets;
  const moved = source.bills[0];
  await useBudgetStore.getState().moveExpenseBetweenBudgets(source.id, source.id, moved.expense.id, moved.id, moved.amount);
  expect(useBudgetStore.getState().budgets).toBe(before);
  expect(replaceAllBudgets).not.toHaveBeenCalled();
});
it("rejects a missing destination before saving", async () => {
  const { source } = budgets(); const moved = source.bills[0];
  await expect(useBudgetStore.getState().moveExpenseBetweenBudgets(source.id, "missing", moved.expense.id, moved.id, moved.amount)).rejects.toThrow("not found");
  expect(replaceAllBudgets).not.toHaveBeenCalled();
});
it("immediately assigns an unfunded bill when moving another expense frees enough income", async () => {
  const incomes = [makeIncome({ id: "early" }), makeIncome({ id: "late", amount: 500, date: new Date(2026, 10, 10) })];
  const expenses = [
    makeExpense({ id: "rent", amount: 400, date: new Date(2026, 10, 11) }),
    makeExpense({ id: "large", amount: 600, date: new Date(2026, 10, 12) }),
    makeExpense({ id: "unfunded", amount: 500, date: new Date(2026, 10, 13) }),
  ];
  const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2027, 1, 28));
  useBudgetStore.setState({ incomes, expenses, ...forecast });
  const [early, late] = forecast.budgets;
  const moved = late.bills[0]; moved.paid = true;
  expect(forecast.unfundedExpenses).toHaveLength(1);
  await useBudgetStore.getState().moveExpenseBetweenBudgets(late.id, early.id, "rent", moved.id, 400);
  expect(useBudgetStore.getState().unfundedExpenses).toEqual([]);
  const updated = useBudgetStore.getState().budgets;
  expect(updated[1].bills.map(bill => bill.expense.id)).toEqual(["unfunded"]);
  expect(updated[0].bills.find(bill => bill.id === moved.id)).toMatchObject({ paid: true, assignmentOverride: true });
  expect(updated.map(budget => budget.remainingBalance)).toEqual([0, 0]);
});

it("moves the same occurrence twice without duplicates and keeps the final assignment on refresh", async () => {
  const { source, destination, unrelated } = budgets();
  const original = source.bills.find(bill => bill.expense.id === "rent")!;
  original.paid = true;
  original.amountOverride = true;
  const store = useBudgetStore.getState();
  await store.moveExpenseBetweenBudgets(source.id, destination.id, original.expense.id, original.id, original.amount);
  await store.moveExpenseBetweenBudgets(destination.id, unrelated.id, original.expense.id, original.id, original.amount);
  await store.refreshBudgets();
  const updated = useBudgetStore.getState().budgets;
  expect(updated.flatMap(budget => budget.bills).filter(bill => bill.id === original.id)).toHaveLength(1);
  const final = updated.find(budget => budget.id === unrelated.id)!;
  expect(final.bills.find(bill => bill.id === original.id)).toMatchObject({
    paid: true, amount: original.amount, amountOverride: true, assignmentOverride: true,
    expense: { id: original.expense.id, date: original.expense.date, name: original.expense.name },
  });
  expect(updated.find(budget => budget.id === source.id)!.bills.some(bill => bill.id === original.id)).toBe(false);
  expect(updated.find(budget => budget.id === destination.id)!.bills.some(bill => bill.id === original.id)).toBe(false);
  expect(final.remainingBalance).toBe(74.5);
});

it("retains the first saved assignment if a subsequent move fails, including after refresh", async () => {
  const { source, destination, unrelated } = budgets();
  const original = source.bills.find(bill => bill.expense.id === "rent")!;
  const store = useBudgetStore.getState();
  await store.moveExpenseBetweenBudgets(source.id, destination.id, original.expense.id, original.id, original.amount);
  const saved = useBudgetStore.getState().budgets;
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  await expect(store.moveExpenseBetweenBudgets(destination.id, unrelated.id, original.expense.id, original.id, original.amount)).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(saved);
  await store.refreshBudgets();
  const updated = useBudgetStore.getState().budgets;
  expect(updated.find(budget => budget.id === destination.id)!.bills.find(bill => bill.id === original.id)).toMatchObject({ assignmentOverride: true });
  expect(updated.find(budget => budget.id === unrelated.id)!.bills.some(bill => bill.id === original.id)).toBe(false);
});
