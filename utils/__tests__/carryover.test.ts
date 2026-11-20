import { buildBudgetForecast, getBudgetCalculationStart, getBudgetPeriod, budgetMatchesMonth } from "../buildBudgets";
import { iterateOccurrences, dayKey } from "../occurrenceDates";
import useBudgetStore from "../../store/useBudgetStore";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
}));
const now = new Date(2026, 10, 17);
const incomes = [{ id: "pay", name: "Pay", amount: 3000, date: new Date(2026, 8, 30), frequency: { value: 3, unit: "months" as const } }];
const expenses = [{ id: "rent", name: "Rent", amount: 500, date: new Date(2026, 9, 2), frequency: { value: 1, unit: "months" as const } }];

it("carries earlier income forward after charging spending before the selected month", async () => {
  jest.useFakeTimers().setSystemTime(now);
  try {
    useBudgetStore.setState({ incomes, expenses, budgets: [], unfundedExpenses: [] });
    await useBudgetStore.getState().refreshBudgets();
    const budget = useBudgetStore.getState().budgets[0];
    expect(dayKey(budget.date)).toBe("2026-09-30");
    expect(budget.bills.map(bill => dayKey(bill.expense.date))).toEqual(["2026-10-02", "2026-11-02", "2026-12-02"]);
    expect(budget.remainingBalance).toBe(1500);
    expect(useBudgetStore.getState().unfundedExpenses).toEqual([]);
    expect(budgetMatchesMonth(budget, 11, 2026, now)).toBe(true);
    expect(budgetMatchesMonth(budget, 11, 2027, now)).toBe(false);
  } finally { jest.useRealTimers(); }
});

it("preserves paid and manual historical spending on carryover budgets", () => {
  const { start, end } = getBudgetPeriod(now, incomes);
  const calculationStart = getBudgetCalculationStart(start, incomes, []);
  const original = buildBudgetForecast(incomes, expenses, calculationStart, end);
  original.budgets[0].bills[0].paid = true;
  original.budgets[0].bills.push({ id: "manual", amount: 200, paid: true, sort_order: 3, expense: { id: "manual:manual", name: "Groceries", amount: 200, date: new Date(2026, 8, 30), frequency: undefined } });
  const next = buildBudgetForecast(incomes, expenses, calculationStart, end, original.budgets);
  expect(next.budgets[0].remainingBalance).toBe(1300);
  expect(next.budgets[0].bills.find(bill => bill.expense.id === "rent")?.paid).toBe(true);
});

it("does not silently truncate the historical spending range at 5000 occurrences", () => {
  const dates = iterateOccurrences("2010-01-01", { value: 1, unit: "days" }, new Date(2010, 0, 1), new Date(2026, 10, 17));
  expect(dates.length).toBeGreaterThan(5000);
  expect(dayKey(dates[dates.length - 1])).toBe("2026-11-17");
});
