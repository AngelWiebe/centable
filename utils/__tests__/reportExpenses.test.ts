import { groupReportExpenses, summarizeReportExpenses, summarizeReportIncome } from "../reportExpenses";
import { buildBudgetForecast } from "../buildBudgets";
const start = new Date(2026, 10, 1), end = new Date(2026, 10, 30);
const expense = { id: "rent", name: "Rent", amount: 150, date: new Date(2026, 10, 2), frequency: undefined };
it("includes unfunded bills in totals and breakdowns even when no budgets exist", () => {
  const forecast = buildBudgetForecast([], [expense], start, end);
  const report = summarizeReportExpenses([], forecast.unfundedExpenses, start, end);
  expect(report.totalExpenses).toBe(150); expect(report.totalUnfunded).toBe(150);
  expect(report.expenseBreakdown.Rent).toBe(150); expect(report.unfunded[0].shortfall).toBe(150);
});
it("keeps allocated balance distinct from the full amount and shortfall of an unfunded bill", () => {
  const income = { id: "pay", name: "Pay", amount: 100, date: start, frequency: undefined };
  const forecast = buildBudgetForecast([income], [expense], start, end);
  const report = summarizeReportExpenses(forecast.budgets, forecast.unfundedExpenses, start, end);
  expect(report.totalExpenses).toBe(150); expect(report.unfunded[0].shortfall).toBe(50);
  expect(forecast.budgets[0].remainingBalance).toBe(100);
});
it("filters unfunded occurrences by date and adds funded and unfunded amounts in cents", () => {
  const income = { id: "pay", name: "Pay", amount: 0.3, date: start, frequency: undefined };
  const forecast = buildBudgetForecast([income], [
    { ...expense, id: "a", amount: 0.1 }, { ...expense, id: "b", amount: 0.2, date: new Date(2026, 10, 3) },
    { ...expense, id: "c", amount: 0.1, date: new Date(2026, 10, 4) },
    { ...expense, id: "next", amount: 20, date: new Date(2026, 11, 2) },
  ], start, new Date(2026, 11, 31));
  const report = summarizeReportExpenses(forecast.budgets, forecast.unfundedExpenses, start, end);
  expect(report.totalExpenses).toBe(0.4); expect(report.totalUnfunded).toBe(0.1);
  expect(report.unfunded.map(item => item.expense.id)).toEqual(["c"]);
});

it("uses the expense occurrence date even when its income falls in another month", () => {
  const income = { id: "pay", name: "Pay", amount: 1000, date: new Date(2026, 10, 30), frequency: undefined };
  const forecast = buildBudgetForecast([income], [{ ...expense, amount: 500, date: new Date(2026, 11, 1) }], start, new Date(2026, 11, 31));
  expect(summarizeReportExpenses(forecast.budgets, [], start, end).totalExpenses).toBe(0);
  const december = summarizeReportExpenses(forecast.budgets, [], new Date(2026, 11, 1), new Date(2026, 11, 31));
  expect(december.totalExpenses).toBe(500);
  expect(december.expenseCount).toBe(1);
});
it("keeps the expense's reporting month the same when it changes between funded and unfunded", () => {
  const december = { ...expense, date: new Date(2026, 11, 1) };
  const income = { id: "pay", name: "Pay", amount: 1000, date: start, frequency: undefined };
  for (const incomes of [[], [income]]) {
    const forecast = buildBudgetForecast(incomes, [december], start, new Date(2026, 11, 31));
    expect(summarizeReportExpenses(forecast.budgets, forecast.unfundedExpenses, start, end).totalExpenses).toBe(0);
    expect(summarizeReportExpenses(forecast.budgets, forecast.unfundedExpenses, new Date(2026, 11, 1), new Date(2026, 11, 31)).totalExpenses).toBe(150);
  }
});

it("merges small categories with a real Other category without losing its value", () => {
  const result = groupReportExpenses({ Other: 80, Rent: 900, Coffee: 20 });
  expect(result).toEqual({ Other: 100, Rent: 900 });
  expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(1000);
});
it("counts a small real Other category only once", () => {
  expect(groupReportExpenses({ Other: 2, Rent: 980, Coffee: 18 })).toEqual({ Rent: 980, Other: 20 });
});
it("keeps categories at exactly five percent and does not mutate input", () => {
  const input = Object.freeze({ Rent: 95, Coffee: 5 });
  expect(groupReportExpenses(input)).toEqual(input);
});
it("groups decimal amounts in cents and handles an empty report", () => {
  expect(groupReportExpenses({ Rent: 9.8, Coffee: 0.1, Tea: 0.1 })).toEqual({ Rent: 9.8, Other: 0.2 });
  expect(groupReportExpenses({})).toEqual({});
});

it("sums income names that collide with Object prototype properties as numbers", () => {
  const names = ["constructor", "__proto__", "toString", "constructor"];
  const incomes = names.map((name, i) => ({ id: String(i), name, amount: 100, date: start, frequency: undefined }));
  const budgets = buildBudgetForecast(incomes, [], start, end).budgets;
  const summary = summarizeReportIncome(budgets);
  expect(summary.totalIncome).toBe(400);
  expect(summary.incomeBreakdown.constructor).toBe(200);
  expect(summary.incomeBreakdown.__proto__).toBe(100);
  expect(Object.values(summary.incomeBreakdown).every(amount => typeof amount === "number")).toBe(true);
});
