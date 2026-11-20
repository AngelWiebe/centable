import { buildBudgetForecast } from "../buildBudgets";
const start = new Date(2026, 10, 1);
const end = new Date(2026, 10, 30);
const income = { id: "pay", name: "Pay", amount: 100, date: start, frequency: undefined };
function seed() {
  const forecast = buildBudgetForecast([income], [], start, end);
  forecast.budgets[0].bills.push({ id: "coffee", amount: 25, paid: true, sort_order: 0, expense: {
    id: "manual:coffee", name: "Coffee", amount: 25, date: new Date(2026, 10, 3, 12), frequency: undefined,
  } });
  return forecast;
}
it("retains manual details when the income date changes and another budget can fund the expense", () => {
  const prior = seed();
  const result = buildBudgetForecast([{ ...income, date: new Date(2026, 10, 2) }], [], start, end, prior.budgets);
  expect(result.budgets[0].bills[0]).toMatchObject({ id: "coffee", amount: 25, paid: true, expense: { name: "Coffee" } });
});
it("keeps orphaned manual expenses unfunded and restores them when income becomes available", () => {
  const prior = seed();
  const result = buildBudgetForecast([{ ...income, date: new Date(2026, 10, 5) }], [], start, end, prior.budgets);
  expect(result.unfundedExpenses[0]).toMatchObject({ id: "coffee", amount: 25, paid: true, expense: { name: "Coffee" } });
  const repeat = buildBudgetForecast([], [], start, end, result.budgets, {}, [], result.unfundedExpenses);
  expect(repeat.unfundedExpenses).toEqual(result.unfundedExpenses);
  const restored = buildBudgetForecast([income], [], start, end, [], {}, [], repeat.unfundedExpenses);
  expect(restored.budgets[0].bills[0]).toMatchObject({ id: "coffee", paid: true });
  expect(restored.unfundedExpenses).toEqual([]);
});
