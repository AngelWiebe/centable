import { BudgetForecast, StoredBudget, UnfundedExpense } from "../types/budget";
const iso = (value: Date | string) => new Date(value).toISOString();
function budgetKey(budget: StoredBudget): string {
  return JSON.stringify([budget.id, iso(budget.date), budget.income.id, budget.amount, budget.remainingBalance, !!budget.amountOverride,
    budget.bills.map((bill, index) => [bill.id, bill.expense.id, iso(bill.expense.date), bill.expense.name,
      bill.amount, bill.paid, index, !!bill.assignmentOverride, !!bill.amountOverride])]);
}
function unfundedKey(item: UnfundedExpense): string {
  return JSON.stringify([item.id, item.expense.id, iso(item.expense.date), item.expense.name,
    item.amount, item.paid, item.shortfall, !!item.amountOverride]);
}
export function forecastChanges(previous: BudgetForecast, next: BudgetForecast) {
  const oldBudgets = new Map(previous.budgets.map(budget => [budget.id, budget]));
  const oldUnfunded = new Map(previous.unfundedExpenses.map(item => [item.id, item]));
  const nextIds = new Set(next.budgets.map(item => item.id));
  const nextUnfundedIds = new Set(next.unfundedExpenses.map(item => item.id));
  const changedBudgets = next.budgets.filter(item => !oldBudgets.has(item.id) || budgetKey(item) !== budgetKey(oldBudgets.get(item.id)!));
  const changedUnfunded = next.unfundedExpenses.filter(item => !oldUnfunded.has(item.id) || unfundedKey(item) !== unfundedKey(oldUnfunded.get(item.id)!));
  const removedBudgetIds = previous.budgets.filter(item => !nextIds.has(item.id)).map(item => item.id);
  return {
    changedBudgets, changedUnfunded, removedBudgetIds,
    clearBudgetIds: [...removedBudgetIds, ...changedBudgets.filter(item => oldBudgets.has(item.id)).map(item => item.id)],
    clearUnfundedIds: [...previous.unfundedExpenses.filter(item => !nextUnfundedIds.has(item.id)).map(item => item.id),
      ...changedUnfunded.filter(item => oldUnfunded.has(item.id)).map(item => item.id)],
  };
}
