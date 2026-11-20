import { getBudgetPeriod, buildBudgets } from "../buildBudgets";
import { dayKey } from "../occurrenceDates";
import { IncomeInterface } from "../../types/income";

const now = new Date(2026, 10, 17);
const quarterly: IncomeInterface = {
  id: "quarterly", name: "Quarterly pay", amount: 3000,
  date: new Date(2027, 0, 1), frequency: { value: 3, unit: "months" },
};

describe("income-aware forecast window", () => {
  it("extends through the next quarterly income after the last visible month", () => {
    const { start, end } = getBudgetPeriod(now, [quarterly]);
    expect(dayKey(start)).toBe("2026-10-01");
    expect(dayKey(end)).toBe("2027-04-01");
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });

  it("fills the visible January budget with March expenses and excludes dates past the forecast", () => {
    const { start, end } = getBudgetPeriod(now, [quarterly]);
    const budgets = buildBudgets([quarterly], [{
      id: "rent", name: "Rent", amount: 500,
      date: new Date(2027, 0, 5), frequency: { value: 1, unit: "months" },
    }], start, end);
    const january = budgets.find(budget => dayKey(budget.date) === "2027-01-01");
    expect(january?.bills.map(bill => dayKey(bill.expense.date))).toEqual(["2027-01-05", "2027-02-05", "2027-03-05"]);
    expect(january?.remainingBalance).toBe(1500);
    expect(budgets.map(budget => dayKey(budget.date))).toEqual(["2027-01-01", "2027-04-01"]);
  });

  it("allows fallback from the boundary day's income but excludes the following day's expense", () => {
    const incomes = [quarterly, { ...quarterly, id: "next", date: new Date(2027, 3, 1), amount: 100, frequency: undefined }];
    // The quarterly series also pays on the boundary; use a one-time visible income here.
    incomes[0] = { ...quarterly, frequency: undefined };
    const { start, end } = getBudgetPeriod(now, incomes);
    const budgets = buildBudgets(incomes, [
      { id: "boundary", name: "Boundary bill", amount: 200, date: new Date(2027, 3, 1, 23), frequency: undefined },
      { id: "outside", name: "Outside bill", amount: 200, date: new Date(2027, 3, 2), frequency: undefined },
    ], start, end);
    expect(budgets[0].bills.map(bill => bill.expense.id)).toEqual(["boundary"]);
    expect(budgets[0].remainingBalance).toBe(2800);
    expect(budgets[1].bills).toEqual([]);
  });

  it("uses the earliest next income across multiple schedules, regardless of input order", () => {
    const other = { ...quarterly, id: "other", date: new Date(2027, 2, 10), frequency: undefined };
    expect(dayKey(getBudgetPeriod(now, [quarterly, other]).end)).toBe("2027-03-10");
    expect(dayKey(getBudgetPeriod(now, [other, quarterly]).end)).toBe("2027-03-10");
  });

  it("preserves the existing minimum forecast for monthly income, no income, or past one-time income", () => {
    const monthly = { ...quarterly, frequency: { value: 1, unit: "months" as const } };
    for (const incomes of [[], [monthly], [{ ...quarterly, frequency: undefined }]]) {
      expect(dayKey(getBudgetPeriod(now, incomes).end)).toBe("2027-02-28");
    }
  });

  it("handles year rollover and restores a month-end anchor after February", () => {
    const income = { ...quarterly, date: new Date(2026, 11, 31), frequency: { value: 3, unit: "months" as const } };
    expect(dayKey(getBudgetPeriod(new Date(2026, 11, 17), [income]).end)).toBe("2027-03-31");
  });
});
