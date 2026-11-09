import { ExpenseInterface } from "../../types/expense";
import { IncomeInterface } from "../../types/income";
import {
  buildBudgets,
  expenseOccurrenceKey,
  getBudgetPeriod,
} from "../buildBudgets";
import { generateOccurrences } from "../generateOccurrences";
import { getNextOccurrenceDate } from "../getNext";
import { dayKey } from "../occurrenceDates";

const income = (
  partial: Partial<IncomeInterface> & Pick<IncomeInterface, "id" | "date">
): IncomeInterface => ({
  name: "Paycheck",
  amount: 2000,
  frequency: { value: 1, unit: "months" },
  ...partial,
});

const expense = (
  partial: Partial<ExpenseInterface> & Pick<ExpenseInterface, "id" | "date">
): ExpenseInterface => ({
  name: "Rent",
  amount: 500,
  frequency: { value: 1, unit: "months" },
  ...partial,
});

describe("generateOccurrences", () => {
  const periodStart = new Date(2026, 7, 1);
  const periodEnd = new Date(2026, 10, 30, 23, 59, 59, 999);

  it("keeps a monthly series on its start day instead of the first of the month", () => {
    const occurrences = generateOccurrences(
      [
        income({
          id: "pay",
          date: new Date(2026, 0, 15),
        }),
      ],
      periodEnd,
      periodStart
    );

    expect(occurrences.map((item) => dayKey(item.date))).toEqual([
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
      "2026-11-15",
    ]);
    expect(occurrences.every((item) => item.id === "pay")).toBe(true);
  });

  it("keeps a weekly series aligned to the original weekday", () => {
    const anchor = new Date(2026, 0, 2); // Friday
    const occurrences = generateOccurrences(
      [
        income({
          id: "weekly",
          date: anchor,
          frequency: { value: 2, unit: "weeks" },
        }),
      ],
      periodEnd,
      periodStart
    );

    expect(occurrences.length).toBeGreaterThan(0);
    expect(
      occurrences.every((item) => new Date(item.date).getDay() === anchor.getDay())
    ).toBe(true);
    for (let index = 1; index < occurrences.length; index += 1) {
      const previous = new Date(occurrences[index - 1].date);
      const current = new Date(occurrences[index].date);
      const utcPrevious = Date.UTC(
        previous.getFullYear(),
        previous.getMonth(),
        previous.getDate()
      );
      const utcCurrent = Date.UTC(
        current.getFullYear(),
        current.getMonth(),
        current.getDate()
      );
      expect((utcCurrent - utcPrevious) / 86400000).toBe(14);
    }
  });

  it("clamps monthly dates that do not exist, then restores the anchor day", () => {
    const occurrences = generateOccurrences(
      [
        income({
          id: "eom",
          date: new Date(2026, 0, 31),
          frequency: { value: 1, unit: "months" },
        }),
      ],
      new Date(2026, 3, 30),
      new Date(2026, 0, 1)
    );

    expect(occurrences.map((item) => dayKey(item.date))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("generates semi-monthly dates without getting stuck on the 15th", () => {
    const occurrences = generateOccurrences(
      [
        expense({
          id: "phone",
          date: new Date(2026, 8, 1),
          frequency: { value: 1, unit: "semi-monthly" },
        }),
      ],
      new Date(2026, 9, 31),
      new Date(2026, 8, 1)
    );

    expect(occurrences.map((item) => dayKey(item.date))).toEqual([
      "2026-09-01",
      "2026-09-15",
      "2026-10-01",
      "2026-10-15",
    ]);
  });

  it("steps from a late-month semi-monthly date onto the 1st of the next month", () => {
    const occurrences = generateOccurrences(
      [
        expense({
          id: "phone",
          date: new Date(2026, 0, 31),
          frequency: { value: 1, unit: "semi-monthly" },
        }),
      ],
      new Date(2026, 2, 15),
      new Date(2026, 0, 1)
    );

    expect(occurrences.map((item) => dayKey(item.date))).toEqual([
      "2026-01-31",
      "2026-02-01",
      "2026-02-15",
      "2026-03-01",
      "2026-03-15",
    ]);
  });

  it("includes a one-time item only when its date is inside the period", () => {
    const occurrences = generateOccurrences(
      [
        expense({
          id: "once",
          date: new Date(2026, 8, 20),
          frequency: undefined,
        }),
        expense({
          id: "outside",
          date: new Date(2026, 11, 1),
          frequency: undefined,
        }),
      ],
      periodEnd,
      periodStart
    );

    expect(occurrences.map((item) => item.id)).toEqual(["once"]);
  });
});

describe("getNextOccurrenceDate", () => {
  it("advances a semi-monthly date that lands on the 15th", () => {
    const next = getNextOccurrenceDate(
      new Date(2026, 8, 15),
      { value: 1, unit: "semi-monthly" },
      new Date(2026, 8, 26)
    );

    expect(dayKey(next)).toBe("2026-10-01");
  });
});

describe("buildBudgets", () => {
  const periodStart = new Date(2026, 7, 1);
  const periodEnd = new Date(2026, 10, 30, 23, 59, 59, 999);

  it("creates one budget per income occurrence and assigns same-day expenses to it", () => {
    const budgets = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 1500 })],
      periodStart,
      periodEnd
    );

    expect(budgets.map((budget) => dayKey(budget.date))).toEqual([
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
    ]);

    for (const budget of budgets) {
      expect(budget.bills).toHaveLength(1);
      expect(budget.bills[0].expense.id).toBe("rent");
      expect(dayKey(budget.bills[0].expense.date)).toBe(dayKey(budget.date));
      expect(budget.remainingBalance).toBe(500);
    }
  });

  it("assigns an expense to the nearest earlier income, not a later one", () => {
    const budgets = buildBudgets(
      [
        income({
          id: "pay",
          date: new Date(2026, 8, 1),
          amount: 2000,
          frequency: { value: 15, unit: "days" },
        }),
      ],
      [
        expense({
          id: "groceries",
          date: new Date(2026, 8, 10),
          amount: 100,
          frequency: undefined,
        }),
      ],
      periodStart,
      periodEnd
    );

    const septemberFirst = budgets.find(
      (budget) => dayKey(budget.date) === "2026-09-01"
    );
    const septemberSixteenth = budgets.find(
      (budget) => dayKey(budget.date) === "2026-09-16"
    );

    expect(septemberFirst?.bills.map((bill) => bill.expense.id)).toEqual([
      "groceries",
    ]);
    expect(septemberSixteenth?.bills).toEqual([]);
  });

  it("falls back to an earlier income when the nearest one cannot cover the expense", () => {
    const budgets = buildBudgets(
      [
        income({
          id: "small",
          name: "Side gig",
          date: new Date(2026, 8, 1),
          amount: 400,
          frequency: undefined,
        }),
        income({
          id: "main",
          name: "Salary",
          date: new Date(2026, 7, 20),
          amount: 2000,
          frequency: undefined,
        }),
      ],
      [
        expense({
          id: "rent",
          date: new Date(2026, 8, 5),
          amount: 1500,
          frequency: undefined,
        }),
      ],
      periodStart,
      periodEnd
    );

    const sideGig = budgets.find((budget) => budget.income.id === "small");
    const salary = budgets.find((budget) => budget.income.id === "main");

    expect(sideGig?.bills).toEqual([]);
    expect(salary?.bills.map((bill) => bill.expense.id)).toEqual(["rent"]);
    expect(salary?.remainingBalance).toBe(500);
  });

  it("leaves an expense unassigned when no earlier income can cover it", () => {
    const budgets = buildBudgets(
      [
        income({
          id: "pay",
          date: new Date(2026, 8, 15),
          amount: 100,
          frequency: undefined,
        }),
      ],
      [
        expense({
          id: "rent",
          date: new Date(2026, 8, 10),
          amount: 1500,
          frequency: undefined,
        }),
      ],
      periodStart,
      periodEnd
    );

    expect(budgets).toHaveLength(1);
    expect(budgets[0].bills).toEqual([]);
  });

  it("applies an updated income amount and name to every calculated budget", () => {
    const original = buildBudgets(
      [
        income({
          id: "pay",
          name: "Salary",
          date: new Date(2026, 8, 1),
          amount: 2000,
        }),
      ],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd
    );
    original[0].bills[0].paid = true;

    const updated = buildBudgets(
      [
        income({
          id: "pay",
          name: "Paycheck",
          date: new Date(2026, 8, 1),
          amount: 3000,
        }),
      ],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd,
      original,
      { income: { id: "pay", previousAmount: 2000 } }
    );

    expect(updated.every((budget) => budget.amount === 3000)).toBe(true);
    expect(updated.every((budget) => budget.income.name === "Paycheck")).toBe(
      true
    );
    expect(updated.every((budget) => budget.remainingBalance === 2500)).toBe(
      true
    );
    expect(
      updated.find((budget) => dayKey(budget.date) === "2026-09-01")?.bills[0]
        .paid
    ).toBe(true);
  });

  it("moves an updated expense off a budget that can no longer cover it", () => {
    const incomes = [
      income({
        id: "early",
        date: new Date(2026, 8, 1),
        amount: 1000,
        frequency: undefined,
      }),
      income({
        id: "later",
        date: new Date(2026, 8, 10),
        amount: 300,
        frequency: undefined,
      }),
    ];
    const original = buildBudgets(
      incomes,
      [
        expense({
          id: "bill",
          name: "Groceries",
          date: new Date(2026, 8, 12),
          amount: 200,
          frequency: { value: 1, unit: "months" },
        }),
      ],
      periodStart,
      periodEnd
    );

    expect(
      original
        .find((budget) => budget.income.id === "later")
        ?.bills.map((bill) => dayKey(bill.expense.date))
    ).toEqual(["2026-09-12"]);

    const updated = buildBudgets(
      incomes,
      [
        expense({
          id: "bill",
          name: "Groceries",
          date: new Date(2026, 8, 12),
          amount: 800,
          frequency: { value: 1, unit: "months" },
        }),
      ],
      periodStart,
      periodEnd,
      original,
      { expense: { id: "bill", previousAmount: 200 } }
    );

    expect(
      updated.find((budget) => budget.income.id === "later")?.bills
    ).toEqual([]);
    const earlyBills =
      updated.find((budget) => budget.income.id === "early")?.bills ?? [];
    expect(earlyBills.map((bill) => bill.amount)).toEqual([800]);
    expect(
      updated.find((budget) => budget.income.id === "early")?.remainingBalance
    ).toBe(200);
  });

  it("moves calculated budgets when an income start date changes", () => {
    const updated = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 5), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd
    );

    expect(updated.map((budget) => dayKey(budget.date))).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
    expect(
      updated
        .find((budget) => dayKey(budget.date) === "2026-09-05")
        ?.bills.map((bill) => dayKey(bill.expense.date))
    ).toEqual(["2026-10-01"]);
  });

  it("keeps a budget-level income amount when the income record changes", () => {
    const original = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd
    );
    const september = original.find(
      (budget) => dayKey(budget.date) === "2026-09-01"
    );
    if (!september) throw new Error("missing September budget");
    september.amount = 2500;
    september.income = { ...september.income, amount: 2500 };
    september.remainingBalance = 2000;

    const updated = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 3000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd,
      original,
      { income: { id: "pay", previousAmount: 2000 } }
    );

    expect(
      updated.find((budget) => dayKey(budget.date) === "2026-09-01")?.amount
    ).toBe(2500);
    expect(
      updated
        .filter((budget) => dayKey(budget.date) !== "2026-09-01")
        .every((budget) => budget.amount === 3000)
    ).toBe(true);
  });

  it("keeps a budget-line expense amount when the expense record changes", () => {
    const original = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 })],
      periodStart,
      periodEnd
    );
    const september = original.find(
      (budget) => dayKey(budget.date) === "2026-09-01"
    );
    if (!september) throw new Error("missing September budget");
    september.bills[0].amount = 650;
    september.bills[0].expense = {
      ...september.bills[0].expense,
      amount: 650,
    };
    september.remainingBalance = 1350;

    const updated = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 700 })],
      periodStart,
      periodEnd,
      original,
      { expense: { id: "rent", previousAmount: 500 } }
    );

    expect(
      updated.find((budget) => dayKey(budget.date) === "2026-09-01")?.bills[0]
        .amount
    ).toBe(650);
    expect(
      updated
        .filter((budget) => dayKey(budget.date) !== "2026-09-01")
        .every((budget) => budget.bills[0].amount === 700)
    ).toBe(true);
  });

  it("leaves a deleted expense occurrence off the budget after a rebuild", () => {
    const periodStart = new Date(2026, 7, 1);
    const periodEnd = new Date(2026, 10, 30, 23, 59, 59, 999);
    const incomes = [
      income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 }),
    ];
    const expenses = [
      expense({ id: "rent", date: new Date(2026, 8, 1), amount: 500 }),
    ];
    const original = buildBudgets(incomes, expenses, periodStart, periodEnd);
    const september = original.find((budget) => dayKey(budget.date) === "2026-09-01");
    if (!september) throw new Error("missing September budget");

    const rebuilt = buildBudgets(
      incomes,
      expenses,
      periodStart,
      periodEnd,
      original.map((budget) =>
        budget.id === september.id ? { ...budget, bills: [] } : budget
      ),
      {},
      [expenseOccurrenceKey("rent", september.bills[0].expense.date)]
    );

    expect(
      rebuilt.find((budget) => dayKey(budget.date) === "2026-09-01")?.bills
    ).toEqual([]);
    expect(
      rebuilt
        .filter((budget) => dayKey(budget.date) !== "2026-09-01")
        .every((budget) => budget.bills.length === 1)
    ).toBe(true);
  });

  it("keeps a paid flag for the same income and expense occurrence", () => {
    const [first] = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 1500 })],
      periodStart,
      periodEnd
    );

    first.bills[0].paid = true;

    const rebuilt = buildBudgets(
      [income({ id: "pay", date: new Date(2026, 8, 1), amount: 2000 })],
      [expense({ id: "rent", date: new Date(2026, 8, 1), amount: 1500 })],
      periodStart,
      periodEnd,
      [first]
    );

    const september = rebuilt.find((budget) => dayKey(budget.date) === "2026-09-01");
    expect(september?.bills[0].paid).toBe(true);
    expect(rebuilt.filter((budget) => dayKey(budget.date) !== "2026-09-01").every(
      (budget) => budget.bills[0].paid === false
    )).toBe(true);
  });
});

describe("getBudgetPeriod", () => {
  it("calculates through three months ahead of the months shown in the filter", () => {
    const { start, end } = getBudgetPeriod(new Date(2026, 8, 26));

    expect(dayKey(start)).toBe("2026-08-01");
    expect(dayKey(end)).toBe("2026-12-31");
  });
});
