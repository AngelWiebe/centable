import { buildBudgetForecast } from "../buildBudgets";
const start = new Date(2026, 10, 1), end = new Date(2026, 10, 30);
const income = { id: "pay", name: "Pay", amount: 1000, date: start, frequency: undefined };
const expense = { id: "rent", name: "Rent", amount: 100, date: new Date(2026, 10, 2), frequency: undefined };
it("keeps an income override after a series temporarily matches its amount", () => {
  const original = buildBudgetForecast([income], [], start, end);
  original.budgets[0].amount = 1200;
  const equal = buildBudgetForecast([{ ...income, amount: 1200 }], [], start, end, original.budgets, { income: { id: "pay", previousAmount: 1000 } });
  expect(equal.budgets[0].amountOverride).toBe(true);
  const after = buildBudgetForecast([{ ...income, amount: 1500 }], [], start, end, equal.budgets, { income: { id: "pay", previousAmount: 1200 } });
  expect(after.budgets[0].amount).toBe(1200);
});
it("keeps expense overrides when the series matches them, including through an unfunded period", () => {
  const original = buildBudgetForecast([income], [expense], start, end);
  original.budgets[0].bills[0].amount = 150;
  const equal = buildBudgetForecast([income], [{ ...expense, amount: 150 }], start, end, original.budgets, { expense: { id: "rent", previousAmount: 100 } });
  const unfunded = buildBudgetForecast([], [{ ...expense, amount: 150 }], start, end, equal.budgets);
  expect(unfunded.unfundedExpenses[0].amountOverride).toBe(true);
  const after = buildBudgetForecast([income], [{ ...expense, amount: 200 }], start, end, [], { expense: { id: "rent", previousAmount: 150 } }, [], unfunded.unfundedExpenses);
  expect(after.budgets[0].bills[0].amount).toBe(150);
  expect(after.budgets[0].bills[0].amountOverride).toBe(true);
});
