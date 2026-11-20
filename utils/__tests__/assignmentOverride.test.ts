import { buildBudgetForecast, expenseOccurrenceKey } from "../buildBudgets";
import { IncomeInterface } from "../../types/income";
import { ExpenseInterface } from "../../types/expense";

const start = new Date(2026, 10, 1);
const end = new Date(2026, 11, 31);
const incomes: IncomeInterface[] = [
  { id: "earlier", name: "Earlier", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined },
  { id: "latest", name: "Latest", amount: 1000, date: new Date(2026, 10, 10), frequency: undefined },
];
const rent: ExpenseInterface = { id: "rent", name: "Rent", amount: 400, date: new Date(2026, 10, 12), frequency: { value: 1, unit: "months" } };
function manuallyMoved() {
  const forecast = buildBudgetForecast(incomes, [rent], start, end);
  const moved = forecast.budgets[1].bills.shift()!;
  moved.assignmentOverride = true;
  moved.paid = true;
  forecast.budgets[0].bills.push(moved);
  return forecast;
}

it("keeps an explicitly moved occurrence on its destination across repeated rebuilds without moving the rest of the series", () => {
  const existing = manuallyMoved();
  const forecast = buildBudgetForecast(incomes, [rent], start, end, existing.budgets);
  expect(forecast.budgets[0].bills).toEqual(existing.budgets[0].bills);
  expect(forecast.budgets[1].bills).toHaveLength(1);
  expect(forecast.budgets[1].bills[0].expense.date.getMonth()).toBe(11);
  expect(forecast.budgets[0].remainingBalance).toBe(600);
  expect(buildBudgetForecast(incomes, [rent], start, end, forecast.budgets)).toEqual(forecast);
});

it("reserves a moved bill before allocating automatic expenses to its destination", () => {
  const existing = manuallyMoved();
  const extra = { ...rent, id: "extra", amount: 700, date: new Date(2026, 10, 2), frequency: undefined };
  const forecast = buildBudgetForecast(incomes, [rent, extra], start, end, existing.budgets);
  expect(forecast.budgets[0].bills.map(bill => bill.expense.id)).toEqual(["rent"]);
  expect(forecast.budgets[0].remainingBalance).toBe(600);
  expect(forecast.unfundedExpenses.map(item => item.expense.id)).toEqual(["extra"]);
});

it("honors an explicit assignment even when the destination becomes overdrawn", () => {
  const existing = manuallyMoved();
  const forecast = buildBudgetForecast([{ ...incomes[0], amount: 300 }, incomes[1]], [rent], start, end, existing.budgets, { income: { id: "earlier", previousAmount: 1000 } });
  expect(forecast.budgets[0].bills[0].assignmentOverride).toBe(true);
  expect(forecast.budgets[0].remainingBalance).toBe(-100);
});

it("falls back to automatic allocation if the destination income was deleted", () => {
  const existing = manuallyMoved();
  const forecast = buildBudgetForecast([incomes[1]], [rent], start, end, existing.budgets);
  expect(forecast.budgets[0].bills[0].paid).toBe(true);
  expect(forecast.budgets[0].bills[0].assignmentOverride).toBeUndefined();
});

it("does not resurrect a dismissed moved occurrence", () => {
  const existing = manuallyMoved();
  const forecast = buildBudgetForecast(incomes, [rent], start, end, existing.budgets, {}, [expenseOccurrenceKey(rent.id, rent.date)]);
  expect(forecast.budgets[0].bills).toEqual([]);
  expect(forecast.budgets[1].bills).toHaveLength(1);
});
