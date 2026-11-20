import { buildBudgetForecast, expenseOccurrenceKey } from "../buildBudgets";
import { dayKey } from "../occurrenceDates";
import { IncomeInterface } from "../../types/income";
import { ExpenseInterface } from "../../types/expense";

const start = new Date(2026, 10, 1);
const end = new Date(2026, 11, 31);
const income = (id: string, amount: number, day = 1): IncomeInterface => ({ id, name: id, amount, date: new Date(2026, 10, day), frequency: undefined });
const expense = (id: string, amount: number, day = 2): ExpenseInterface => ({ id, name: id, amount, date: new Date(2026, 10, day), frequency: undefined });

describe("unfunded forecast occurrences", () => {
  it("retains an unaffordable expense with its exact shortfall without overspending income", () => {
    const forecast = buildBudgetForecast([income("pay", 100)], [expense("rent", 150)], start, end);
    expect(forecast.budgets[0].bills).toEqual([]);
    expect(forecast.budgets[0].remainingBalance).toBe(100);
    expect(forecast.unfundedExpenses).toEqual([expect.objectContaining({
      id: "rent|2026-11-02", amount: 150, shortfall: 50, paid: false,
      expense: expect.objectContaining({ id: "rent", amount: 150 }),
    })]);
  });

  it("keeps expenses visible when there is no income, or only later income", () => {
    for (const incomes of [[], [income("later", 1000, 10)]]) {
      const forecast = buildBudgetForecast(incomes, [expense("rent", 150)], start, end);
      expect(forecast.unfundedExpenses[0].shortfall).toBe(150);
    }
  });

  it("does not combine balances across budgets or count future income toward the shortfall", () => {
    const forecast = buildBudgetForecast([income("a", 80), income("b", 80), income("future", 1000, 10)], [expense("rent", 100)], start, end);
    expect(forecast.unfundedExpenses[0].shortfall).toBe(20);
    expect(forecast.budgets.every(budget => budget.bills.length === 0)).toBe(true);
  });

  it("includes each recurring date once and excludes dismissed occurrences", () => {
    const rent = { ...expense("rent", 150), frequency: { value: 1, unit: "months" as const } };
    const forecast = buildBudgetForecast([], [rent], start, end);
    expect(forecast.unfundedExpenses.map(item => dayKey(item.expense.date))).toEqual(["2026-11-02", "2026-12-02"]);
    const dismissed = buildBudgetForecast([], [rent], start, end, [], {}, [expenseOccurrenceKey("rent", rent.date)]);
    expect(dismissed.unfundedExpenses.map(item => dayKey(item.expense.date))).toEqual(["2026-12-02"]);
  });

  it("retains occurrence overrides and payment while unfunded and restores them when income becomes sufficient", () => {
    const incomes = [income("pay", 300)];
    const expenses = [expense("rent", 150)];
    const original = buildBudgetForecast(incomes, expenses, start, end);
    original.budgets[0].bills[0].amount = 175;
    original.budgets[0].bills[0].paid = true;
    const insufficient = [{ ...incomes[0], amount: 100 }];
    const unfunded = buildBudgetForecast(insufficient, expenses, start, end, original.budgets, { income: { id: "pay", previousAmount: 300 } });
    expect(unfunded.unfundedExpenses[0]).toMatchObject({ amount: 175, paid: true, shortfall: 75 });
    const repeated = buildBudgetForecast(insufficient, expenses, start, end, unfunded.budgets, {}, [], unfunded.unfundedExpenses);
    expect(repeated).toEqual(unfunded);
    const funded = buildBudgetForecast(incomes, expenses, start, end, repeated.budgets, { income: { id: "pay", previousAmount: 100 } }, [], repeated.unfundedExpenses);
    expect(funded.unfundedExpenses).toEqual([]);
    expect(funded.budgets[0].bills[0]).toMatchObject({ amount: 175, paid: true });
  });

  it("uses cent-accurate shortfalls after earlier expenses consume income", () => {
    const forecast = buildBudgetForecast([income("pay", 100)], [expense("first", 99.91), expense("second", 0.1, 3)], start, end);
    expect(forecast.unfundedExpenses[0]).toMatchObject({ amount: 0.1, shortfall: 0.01 });
  });
});
