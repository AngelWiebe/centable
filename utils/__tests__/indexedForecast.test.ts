import * as occurrences from "../generateOccurrences";
import { buildBudgetForecast } from "../buildBudgets";
import { toCents } from "../money";
it("matches a simple nearest-affordable reference allocation", () => {
  let state = 17;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state; };
  const incomes = Array.from({ length: 100 }, (_, i) => ({ id: `pay-${i}`, name: "Pay", amount: random() % 1000 / 100, date: new Date(2026, 10, 1 + random() % 30), frequency: undefined }));
  const expenses = Array.from({ length: 500 }, (_, i) => ({ id: `bill-${i}`, name: "Bill", amount: random() % 1000 / 100, date: new Date(2026, 10, 1 + random() % 30), frequency: undefined }));
  const expected = [...incomes].sort((a, b) => a.date.getTime() - b.date.getTime()).map(income => ({ income, cents: toCents(income.amount), bills: [] as string[] }));
  const unfunded: string[] = [];
  for (const expense of [...expenses].sort((a, b) => a.date.getTime() - b.date.getTime() || b.amount - a.amount)) {
    const chosen = [...expected].reverse().find(item => item.income.date <= expense.date && item.cents >= toCents(expense.amount));
    if (chosen) { chosen.cents -= toCents(expense.amount); chosen.bills.push(expense.id); }
    else unfunded.push(expense.id);
  }
  const actual = buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2026, 10, 30));
  expect(actual.budgets.map(budget => [budget.income.id, toCents(budget.remainingBalance), budget.bills.map(bill => bill.expense.id).sort()])).toEqual(expected.map(item => [item.income.id, item.cents, item.bills.sort()]));
  expect(actual.unfundedExpenses.map(item => item.expense.id)).toEqual(unfunded);
});
it("invalidates recurrence caches after source edits and does not expose cached dates to mutation", () => {
  const income = { id: "pay", name: "Pay", amount: 100, date: new Date(2026, 10, 1), frequency: undefined };
  const expense = { id: "bill", name: "Bill", amount: 10, date: new Date(2026, 10, 2), frequency: undefined };
  const run = () => buildBudgetForecast([income], [expense], new Date(2026, 10, 1), new Date(2026, 10, 30));
  const first = run(); first.budgets[0].bills[0].expense.date.setDate(20);
  expect(run().budgets[0].bills[0].expense.date.getDate()).toBe(2);
  income.amount = 200; expense.date.setDate(3);
  const changed = run();
  expect(changed.budgets[0].amount).toBe(200);
  expect(changed.budgets[0].bills[0].expense.date.getDate()).toBe(3);
});

it("reuses recurrence generation for unchanged series and invalidates only edited sources", () => {
  const spy = jest.spyOn(occurrences, "generateOccurrences");
  try {
    const income = { id: "cached-pay", name: "Pay", amount: 100, date: new Date(2026, 10, 1), frequency: undefined };
    const expense = { id: "cached-bill", name: "Bill", amount: 10, date: new Date(2026, 10, 2), frequency: undefined };
    const run = () => buildBudgetForecast([income], [expense], new Date(2026, 10, 1), new Date(2026, 10, 30));
    run(); expect(spy).toHaveBeenCalledTimes(2);
    run(); expect(spy).toHaveBeenCalledTimes(2);
    income.amount = 200; run(); expect(spy).toHaveBeenCalledTimes(3);
    expense.date.setDate(3); run(); expect(spy).toHaveBeenCalledTimes(4);
  } finally { spy.mockRestore(); }
});
