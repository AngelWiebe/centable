import { StoredBudget } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";
import { generateOccurrences } from "./generateOccurrences";
import { atLocalNoon, dayKey, toLocalDay } from "./occurrenceDates";

/** One month back, the current month, and two months forward. */
export const VISIBLE_BUDGET_MONTHS = 4;

/**
 * Occurrence window for budget calculation. It starts with the first visible
 * month and runs one month past the last one, so the last paycheck on screen
 * still receives expenses dated before the following income.
 */
export function getBudgetPeriod(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() - 1 + VISIBLE_BUDGET_MONTHS + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
}

function occurrenceKey(sourceId: string, date: Date | string): string {
  return `${sourceId}|${dayKey(date)}`;
}

/** Stable id for one expense occurrence, used to keep a deletion across rebuilds. */
export function expenseOccurrenceKey(
  expenseId: string,
  date: Date | string
): string {
  return occurrenceKey(expenseId, date);
}

function paidKey(
  incomeId: string,
  incomeDate: Date | string,
  expenseId: string,
  expenseDate: Date | string
): string {
  return `${occurrenceKey(incomeId, incomeDate)}|${occurrenceKey(expenseId, expenseDate)}`;
}

export type SeriesAmountChange = {
  id: string;
  previousAmount: number;
};

export type BudgetAmountChanges = {
  income?: SeriesAmountChange;
  expense?: SeriesAmountChange;
};

function amountsDiffer(left: number, right: number): boolean {
  return Math.abs(left - right) > 0.001;
}

/**
 * One budget per income occurrence. Each expense occurrence is attached to
 * the latest income that is already available (same day or earlier) and
 * still has enough remaining balance.
 */
export function buildBudgets(
  incomes: IncomeInterface[],
  expenses: ExpenseInterface[],
  periodStart: Date,
  periodEnd: Date,
  existing: StoredBudget[] = [],
  amountChanges: BudgetAmountChanges = {},
  dismissedExpenseKeys: Iterable<string> = []
): StoredBudget[] {
  const paidByAssignment = new Map<string, boolean>();
  const incomeAmountOverrides = new Map<string, number>();
  const expenseAmountOverrides = new Map<string, number>();
  const incomeAmounts = new Map(incomes.map((income) => [income.id, income.amount]));
  const expenseAmounts = new Map(
    expenses.map((expense) => [expense.id, expense.amount])
  );

  for (const budget of existing) {
    const incomeId = budget.income?.id;
    if (!incomeId) continue;

    const incomeBaseline =
      amountChanges.income?.id === incomeId
        ? amountChanges.income.previousAmount
        : incomeAmounts.get(incomeId);
    if (
      incomeBaseline !== undefined &&
      amountsDiffer(budget.amount, incomeBaseline)
    ) {
      incomeAmountOverrides.set(
        occurrenceKey(incomeId, budget.date),
        budget.amount
      );
    }

    for (const bill of budget.bills ?? []) {
      const expenseId = bill.expense?.id;
      if (!expenseId) continue;
      paidByAssignment.set(
        paidKey(incomeId, budget.date, expenseId, bill.expense.date),
        bill.paid
      );

      const expenseBaseline =
        amountChanges.expense?.id === expenseId
          ? amountChanges.expense.previousAmount
          : expenseAmounts.get(expenseId);
      if (
        expenseBaseline !== undefined &&
        amountsDiffer(bill.amount, expenseBaseline)
      ) {
        expenseAmountOverrides.set(
          occurrenceKey(expenseId, bill.expense.date),
          bill.amount
        );
      }
    }
  }

  const dismissedExpenses = new Set(dismissedExpenseKeys);
  const resolvedExpenseAmount = (expense: ExpenseInterface) =>
    expenseAmountOverrides.get(occurrenceKey(expense.id, expense.date)) ??
    expense.amount;

  const incomeOccurrences = generateOccurrences(
    incomes,
    periodEnd,
    periodStart
  ).sort((a, b) => toLocalDay(a.date).getTime() - toLocalDay(b.date).getTime());

  const expenseOccurrences = generateOccurrences(
    expenses,
    periodEnd,
    periodStart
  ).sort((a, b) => {
    const dateDelta = toLocalDay(a.date).getTime() - toLocalDay(b.date).getTime();
    if (dateDelta !== 0) return dateDelta;
    return resolvedExpenseAmount(b) - resolvedExpenseAmount(a);
  });

  const budgets: StoredBudget[] = incomeOccurrences.map((income) => {
    const date = atLocalNoon(income.date);
    const amount =
      incomeAmountOverrides.get(occurrenceKey(income.id, date)) ??
      income.amount ??
      0;
    return {
      id: occurrenceKey(income.id, date),
      date: date.toISOString(),
      income: {
        ...income,
        date,
        amount,
      },
      amount,
      bills: [],
      remainingBalance: amount,
    };
  });

  for (const expense of expenseOccurrences) {
    if (dismissedExpenses.has(occurrenceKey(expense.id, expense.date))) {
      continue;
    }
    const expenseDay = toLocalDay(expense.date).getTime();

    for (let index = budgets.length - 1; index >= 0; index -= 1) {
      const budget = budgets[index];
      const incomeDay = toLocalDay(budget.date).getTime();
      if (incomeDay > expenseDay) continue;
      const billAmount = resolvedExpenseAmount(expense);
      if (budget.remainingBalance < billAmount) continue;

      const paid =
        paidByAssignment.get(
          paidKey(budget.income.id, budget.date, expense.id, expense.date)
        ) ?? false;
      const occurrenceDate = atLocalNoon(expense.date);

      budget.bills.push({
        id: `${budget.id}|${occurrenceKey(expense.id, occurrenceDate)}`,
        amount: billAmount,
        expense: {
          ...expense,
          date: occurrenceDate,
          amount: billAmount,
        },
        paid,
        sort_order: budget.bills.length,
      });
      budget.remainingBalance -= billAmount;
      break;
    }
  }

  for (const budget of budgets) {
    budget.bills.sort(
      (a, b) =>
        toLocalDay(a.expense.date).getTime() -
        toLocalDay(b.expense.date).getTime()
    );
    budget.bills.forEach((bill, index) => {
      bill.sort_order = index;
    });
    budget.remainingBalance =
      budget.amount - budget.bills.reduce((sum, bill) => sum + bill.amount, 0);
  }

  return budgets;
}
