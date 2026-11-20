import { BudgetCapacityIndex } from "./BudgetCapacityIndex";
import { remainingBalance, toCents } from "./money";
import { BudgetForecast, StoredBudget, UnfundedExpense } from "../types/budget";
import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";
import { generateOccurrences } from "./generateOccurrences";
import { getNextOccurrenceDate } from "./getNext";
import { atLocalNoon, dayKey, toLocalDay } from "./occurrenceDates";

const occurrenceCache = new WeakMap<IncomeInterface | ExpenseInterface, { key: string; start: number; end: number; items: (IncomeInterface | ExpenseInterface)[] }>();
function cachedOccurrences<T extends IncomeInterface | ExpenseInterface>(items: T[], end: Date, start: Date): T[] {
  return items.flatMap(item => {
    const key = JSON.stringify(item);
    const cached = occurrenceCache.get(item);
    if (cached?.key === key && cached.start === start.getTime() && cached.end === end.getTime()) return cached.items as T[];
    const occurrences = generateOccurrences([item], end, start);
    occurrenceCache.set(item, { key, start: start.getTime(), end: end.getTime(), items: occurrences });
    return occurrences;
  });
}

/** One month back, the current month, and two months forward. */
export const VISIBLE_BUDGET_MONTHS = 4;

/**
 * Keep the existing minimum forecast and extend through the first scheduled
 * income after the last visible month when necessary. Expenses can fall back
 * to any earlier budget within this forecast; dates beyond it are excluded.
 */
export function getBudgetPeriod(
  now: Date = new Date(),
  incomes: IncomeInterface[] = []
): {
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
  const lastVisibleDay = new Date(
    now.getFullYear(),
    now.getMonth() - 1 + VISIBLE_BUDGET_MONTHS,
    0
  );
  let nextIncome: Date | undefined;
  for (const income of incomes) {
    const anchor = toLocalDay(income.date);
    const next = income.frequency
      ? getNextOccurrenceDate(anchor, income.frequency, lastVisibleDay)
      : anchor;
    if (next.getTime() <= lastVisibleDay.getTime() || !Number.isFinite(next.getTime())) {
      continue;
    }
    if (!nextIncome || next.getTime() < nextIncome.getTime()) {
      nextIncome = next;
    }
  }
  if (nextIncome && nextIncome.getTime() > end.getTime()) {
    end.setTime(nextIncome.getTime());
    // Include all expenses on the next income's calendar day.
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

/** Include earlier paychecks and all intervening spending, independently of the display window. */
export function getBudgetCalculationStart(visibleStart: Date, incomes: IncomeInterface[], existing: StoredBudget[]): Date {
  let start = toLocalDay(visibleStart);
  for (const value of [...incomes.map(item => item.date), ...existing.map(item => item.date)]) {
    const day = toLocalDay(value);
    if (day.getTime() < start.getTime()) start = day;
  }
  return start;
}

/** Show older carryover budgets when they fund expenses due in the selected month. */
export function budgetMatchesMonth(budget: StoredBudget, month: number, year: number, now = new Date()): boolean {
  const date = toLocalDay(budget.date);
  if (date.getMonth() + 1 === month && date.getFullYear() === year) return true;
  const firstVisibleMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date.getTime() < firstVisibleMonth.getTime() && budget.bills.some(bill => {
    const expenseDate = toLocalDay(bill.expense.date);
    return expenseDate.getMonth() + 1 === month && expenseDate.getFullYear() === year;
  });
}

function occurrenceKey(sourceId: string, date: Date | string): string {
  return `${sourceId}|${dayKey(date)}`;
}

const MANUAL_EXPENSE_PREFIX = "manual:";

/** An expense typed onto one budget, rather than generated from the expense list. */
export function isManualBudgetExpense(expenseId: string | undefined): boolean {
  return !!expenseId?.startsWith(MANUAL_EXPENSE_PREFIX);
}

export function manualExpenseId(billId: string): string {
  return `${MANUAL_EXPENSE_PREFIX}${billId}`;
}

/** Stable id for one expense occurrence, used to keep a deletion across rebuilds. */
export function expenseOccurrenceKey(
  expenseId: string,
  date: Date | string
): string {
  return occurrenceKey(expenseId, date);
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
  return toCents(left) !== toCents(right);
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
  return buildBudgetForecast(incomes, expenses, periodStart, periodEnd, existing, amountChanges, dismissedExpenseKeys).budgets;
}

export function buildBudgetForecast(
  incomes: IncomeInterface[],
  expenses: ExpenseInterface[],
  periodStart: Date,
  periodEnd: Date,
  existing: StoredBudget[] = [],
  amountChanges: BudgetAmountChanges = {},
  dismissedExpenseKeys: Iterable<string> = [],
  previousUnfunded: UnfundedExpense[] = []
): BudgetForecast {
  const paidByOccurrence = new Map<string, boolean>();
  const manualIds = new Map<string, string>();
  const assignments = new Map<string, { budgetId: string; billId: string }>();
  const sortOrderByBill = new Map<string, number>();
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
      budget.amountOverride || (incomeBaseline !== undefined &&
      amountsDiffer(budget.amount, incomeBaseline))
    ) {
      incomeAmountOverrides.set(
        occurrenceKey(incomeId, budget.date),
        budget.amount
      );
    }

    for (const bill of budget.bills ?? []) {
      if (typeof bill.sort_order === "number") {
        sortOrderByBill.set(bill.id, bill.sort_order);
      }
      const expenseId = bill.expense?.id;
      if (!expenseId) continue;
      if (bill.assignmentOverride) {
        assignments.set(occurrenceKey(expenseId, bill.expense.date), { budgetId: budget.id, billId: bill.id });
      }
      paidByOccurrence.set(
        occurrenceKey(expenseId, bill.expense.date),
        bill.paid
      );

      const expenseBaseline =
        amountChanges.expense?.id === expenseId
          ? amountChanges.expense.previousAmount
          : expenseAmounts.get(expenseId);
      if (
        bill.amountOverride || (expenseBaseline !== undefined &&
        amountsDiffer(bill.amount, expenseBaseline))
      ) {
        expenseAmountOverrides.set(
          occurrenceKey(expenseId, bill.expense.date),
          bill.amount
        );
      }
    }
  }

  for (const item of previousUnfunded) {
    const key = occurrenceKey(item.expense.id, item.expense.date);
    paidByOccurrence.set(key, item.paid);
    const baseline = amountChanges.expense?.id === item.expense.id
      ? amountChanges.expense.previousAmount
      : expenseAmounts.get(item.expense.id);
    if (item.amountOverride || (baseline !== undefined && amountsDiffer(item.amount, baseline))) {
      expenseAmountOverrides.set(key, item.amount);
    }
  }

  const dismissedExpenses = new Set(dismissedExpenseKeys);
  const resolvedExpenseAmount = (expense: ExpenseInterface) =>
    expenseAmountOverrides.get(occurrenceKey(expense.id, expense.date)) ??
    expense.amount;

  const incomeOccurrences = cachedOccurrences(
    incomes,
    periodEnd,
    periodStart
  ).sort((a, b) => toLocalDay(a.date).getTime() - toLocalDay(b.date).getTime());

  const generatedBudgetIds = new Set(incomeOccurrences.map(item => occurrenceKey(item.id, item.date)));
  const orphanManual = new Map<string, ExpenseInterface>();
  for (const budget of existing) {
    for (const bill of budget.bills) {
      if (!isManualBudgetExpense(bill.expense.id)) continue;
      const key = occurrenceKey(bill.expense.id, bill.expense.date);
      manualIds.set(key, bill.id);
      if (!generatedBudgetIds.has(budget.id)) orphanManual.set(key, { ...bill.expense, amount: bill.amount });
    }
  }
  for (const item of previousUnfunded) {
    if (!isManualBudgetExpense(item.expense.id)) continue;
    manualIds.set(occurrenceKey(item.expense.id, item.expense.date), item.id);
    orphanManual.set(occurrenceKey(item.expense.id, item.expense.date), { ...item.expense, amount: item.amount });
  }
  const expenseOccurrences = [
    ...cachedOccurrences(expenses, periodEnd, periodStart),
    ...orphanManual.values(),
  ].sort((a, b) => {
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
      ...(incomeAmountOverrides.has(occurrenceKey(income.id, date)) ? { amountOverride: true } : {}),
    };
  });

  const budgetsById = new Map(budgets.map(budget => [budget.id, budget]));
  // Reserve existing manual spending before assigning generated occurrences.
  for (const previous of existing) {
    const budget = budgetsById.get(previous.id);
    if (!budget) continue;
    for (const bill of previous.bills ?? []) {
      if (!isManualBudgetExpense(bill.expense?.id)) continue;
      if (budget.bills.some((item) => item.id === bill.id)) continue;
      const amount = bill.amount;
      budget.bills.push({
        id: bill.id,
        amount,
        paid: bill.paid,
        ...(bill.amountOverride ? { amountOverride: true } : {}),
        ...(bill.assignmentOverride ? { assignmentOverride: true } : {}),
        sort_order: bill.sort_order,
        expense: {
          ...bill.expense,
          amount,
          date: atLocalNoon(bill.expense.date),
          frequency: undefined,
        },
      });
      budget.remainingBalance = remainingBalance(budget.remainingBalance, [amount]);
    }
  }

  const unfundedExpenses: UnfundedExpense[] = [];
  const positions = new Map(budgets.map((budget, index) => [budget.id, index]));
  const incomeDays = budgets.map(budget => toLocalDay(budget.date).getTime());
  const capacity = new BudgetCapacityIndex(budgets.map(budget => toCents(budget.remainingBalance)));
  // Explicit assignments reserve their destination's money before automatic bills.
  const allocationExpenses = [...expenseOccurrences].sort((a, b) => {
    const aTarget = assignments.get(occurrenceKey(a.id, a.date));
    const bTarget = assignments.get(occurrenceKey(b.id, b.date));
    return Number(!!bTarget && budgetsById.has(bTarget.budgetId)) - Number(!!aTarget && budgetsById.has(aTarget.budgetId));
  });
  for (const expense of allocationExpenses) {
    if (dismissedExpenses.has(occurrenceKey(expense.id, expense.date))) {
      continue;
    }
    const expenseDay = toLocalDay(expense.date).getTime();
    const billAmount = resolvedExpenseAmount(expense);
    const assignment = assignments.get(occurrenceKey(expense.id, expense.date));
    const target = assignment ? budgetsById.get(assignment.budgetId) : undefined;
    let low = 0, high = incomeDays.length - 1, last = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (incomeDays[middle] <= expenseDay) { last = middle; low = middle + 1; }
      else high = middle - 1;
    }
    const index = target ? positions.get(target.id)! : capacity.findLastAffordable(last, toCents(billAmount));
    if (index >= 0) {
      const budget = budgets[index];
      const paid =
        paidByOccurrence.get(
          occurrenceKey(expense.id, expense.date)
        ) ?? false;
      const occurrenceDate = atLocalNoon(expense.date);

      budget.bills.push({
        id: manualIds.get(occurrenceKey(expense.id, occurrenceDate)) ?? (target ? assignment!.billId : `${budget.id}|${occurrenceKey(expense.id, occurrenceDate)}`),
        ...(target ? { assignmentOverride: true } : {}),
        ...(expenseAmountOverrides.has(occurrenceKey(expense.id, expense.date)) ? { amountOverride: true } : {}),
        amount: billAmount,
        expense: {
          ...expense,
          date: occurrenceDate,
          amount: billAmount,
        },
        paid,
        sort_order: budget.bills.length,
      });
      budget.remainingBalance = remainingBalance(budget.remainingBalance, [billAmount]);
      capacity.update(index, toCents(budget.remainingBalance));
    } else {
      const bestAvailableCents = Math.max(0, capacity.maxThrough(last));
      const id = occurrenceKey(expense.id, expense.date);
      unfundedExpenses.push({
        id: manualIds.get(id) ?? id,
        expense: { ...expense, date: atLocalNoon(expense.date), amount: billAmount },
        amount: billAmount,
        paid: paidByOccurrence.get(id) ?? false,
        shortfall: (toCents(billAmount) - bestAvailableCents) / 100,
        ...(expenseAmountOverrides.has(id) ? { amountOverride: true } : {}),
      });
    }
  }

  for (const budget of budgets) {
    const hasCustomOrder = budget.bills.some((bill) =>
      sortOrderByBill.has(bill.id)
    );
    budget.bills.sort((a, b) => {
      if (hasCustomOrder) {
        const aOrder = sortOrderByBill.get(a.id);
        const bOrder = sortOrderByBill.get(b.id);
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
      }
      return (
        toLocalDay(a.expense.date).getTime() -
        toLocalDay(b.expense.date).getTime()
      );
    });
    budget.bills.forEach((bill, index) => {
      bill.sort_order = index;
    });
    budget.remainingBalance =
      remainingBalance(budget.amount, budget.bills.map((bill) => bill.amount));
  }

  return { budgets, unfundedExpenses };
}
