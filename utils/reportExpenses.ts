import { StoredBudget, UnfundedExpense } from "../types/budget";
import { toCents } from "./money";
import { toLocalDay } from "./occurrenceDates";

export function summarizeReportExpenses(budgets: StoredBudget[], unfundedExpenses: UnfundedExpense[], start: Date | null, end: Date | null) {
  const inRange = (date: Date) => {
    const day = toLocalDay(date).getTime();
    return (!start || day >= toLocalDay(start).getTime()) && (!end || day <= toLocalDay(end).getTime());
  };
  const unfunded = unfundedExpenses.filter(item => inRange(item.expense.date));
  const funded = budgets.flatMap(budget => budget.bills
    .filter(bill => inRange(bill.expense.date))
    .map(bill => ({ name: bill.expense.name, amount: bill.amount })));
  const all = [...funded, ...unfunded.map(item => ({ name: item.expense.name, amount: item.amount }))];
  const centsByName: Record<string, number> = Object.create(null);
  for (const item of all) centsByName[item.name] = (centsByName[item.name] ?? 0) + toCents(item.amount);
  return {
    unfunded,
    expenseCount: all.length,
    totalUnfunded: unfunded.reduce((sum, item) => sum + toCents(item.amount), 0) / 100,
    totalExpenses: all.reduce((sum, item) => sum + toCents(item.amount), 0) / 100,
    expenseBreakdown: Object.fromEntries(Object.entries(centsByName).map(([name, cents]) => [name, cents / 100])),
  };
}

/** Group small categories while preserving any real category named Other. */
export function groupReportExpenses(breakdown: Record<string, number>): Record<string, number> {
  const entries = Object.entries(breakdown).map(([name, amount]) => [name, toCents(amount)] as const);
  const total = entries.reduce((sum, [, cents]) => sum + cents, 0);
  const grouped = new Map<string, number>();
  let small = 0;
  for (const [name, cents] of entries) {
    if (total > 0 && cents / total < 0.05) small += cents;
    else grouped.set(name, cents);
  }
  if (small > 0) grouped.set("Other", (grouped.get("Other") ?? 0) + small);
  return Object.fromEntries([...grouped].map(([name, cents]) => [name, cents / 100]));
}

export function summarizeReportIncome(budgets: StoredBudget[]) {
  const centsByName = new Map<string, number>();
  let total = 0;
  for (const budget of budgets) {
    const cents = toCents(budget.income.amount);
    total += cents;
    centsByName.set(budget.income.name, (centsByName.get(budget.income.name) ?? 0) + cents);
  }
  return {
    totalIncome: total / 100,
    incomeBreakdown: Object.fromEntries([...centsByName].map(([name, cents]) => [name, cents / 100])),
  };
}
