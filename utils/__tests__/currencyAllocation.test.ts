import { buildBudgets } from "../buildBudgets";

const start = new Date(2026, 10, 1);
const end = new Date(2026, 10, 30);
const income = (id: string, day: number, amount: number) => ({ id, name: id, date: new Date(2026, 10, day), amount, frequency: undefined });
const expense = (id: string, day: number, amount: number) => ({ id, name: id, date: new Date(2026, 10, day), amount, frequency: undefined });

describe("currency precision in budget allocation", () => {
  it.each([
    [100, 99.9, 0.1],
    [0.3, 0.1, 0.2],
    [1, 0.29, 0.71],
  ])("fully allocates %s minus %s minus %s", (amount, first, second) => {
    const budgets = buildBudgets([income("pay", 1, amount)], [expense("first", 2, first), expense("second", 3, second)], start, end);
    expect(budgets[0].bills.map(bill => bill.expense.id)).toEqual(["first", "second"]);
    expect(budgets[0].remainingBalance).toBe(0);
    expect(buildBudgets([income("pay", 1, amount)], [expense("first", 2, first), expense("second", 3, second)], start, end, budgets)).toEqual(budgets);
  });

  it("keeps an exact-fit expense on the nearest income instead of falling back", () => {
    const budgets = buildBudgets([income("earlier", 1, 100), income("latest", 10, 100)], [expense("first", 11, 99.9), expense("second", 12, 0.1)], start, end);
    expect(budgets[0].bills).toEqual([]);
    expect(budgets[0].remainingBalance).toBe(100);
    expect(budgets[1].bills).toHaveLength(2);
    expect(budgets[1].remainingBalance).toBe(0);
  });

  it("still falls back when the nearest income is short by one cent", () => {
    const budgets = buildBudgets([income("earlier", 1, 100), income("latest", 10, 100)], [expense("first", 11, 99.91), expense("second", 12, 0.1)], start, end);
    expect(budgets[0].bills.map(bill => bill.expense.id)).toEqual(["second"]);
    expect(budgets[0].remainingBalance).toBe(99.9);
    expect(budgets[1].remainingBalance).toBe(0.09);
  });

  it("uses cents when reserving manual expenses before recurring expenses", () => {
    const incomes = [income("pay", 1, 100)];
    const existing = buildBudgets(incomes, [], start, end);
    existing[0].bills.push({ id: "manual", amount: 99.9, paid: true, sort_order: 0, expense: expense("manual:manual", 2, 99.9) });
    const rebuilt = buildBudgets(incomes, [expense("recurring", 3, 0.1)], start, end, existing);
    expect(rebuilt[0].bills).toHaveLength(2);
    expect(rebuilt[0].remainingBalance).toBe(0);
  });
});
