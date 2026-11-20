import { buildBudgets } from "../buildBudgets";
import { dayKey } from "../occurrenceDates";
import { IncomeInterface } from "../../types/income";
import { ExpenseInterface } from "../../types/expense";

const start = new Date(2026, 10, 1);
const end = new Date(2026, 11, 31);
const incomes: IncomeInterface[] = [
  { id: "earlier", name: "Earlier", amount: 2000, date: new Date(2026, 10, 1), frequency: undefined },
  { id: "latest", name: "Latest", amount: 500, date: new Date(2026, 10, 10), frequency: undefined },
];
const expenses: ExpenseInterface[] = [
  { id: "rent", name: "Rent", amount: 400, date: new Date(2026, 10, 12), frequency: undefined },
];

describe("paid status follows an expense occurrence", () => {
  it.each([false, true])("preserves paid=%s when a reduced income pushes the expense backward", paid => {
    const existing = buildBudgets(incomes, expenses, start, end);
    existing[1].bills[0].paid = paid;
    const updated = [incomes[0], { ...incomes[1], amount: 300 }];
    const rebuilt = buildBudgets(updated, expenses, start, end, existing, { income: { id: "latest", previousAmount: 500 } });
    expect(rebuilt[0].bills).toHaveLength(1);
    expect(rebuilt[0].bills[0].paid).toBe(paid);
    expect(rebuilt[1].bills).toEqual([]);
    expect(buildBudgets(updated, expenses, start, end, rebuilt)).toEqual(rebuilt);
  });

  it("preserves payment when the owning income is deleted", () => {
    const existing = buildBudgets(incomes, expenses, start, end);
    existing[1].bills[0].paid = true;
    const rebuilt = buildBudgets([incomes[0]], expenses, start, end, existing);
    expect(rebuilt[0].bills[0].paid).toBe(true);
  });

  it("preserves payment when an expense amount change forces reassignment", () => {
    const existing = buildBudgets(incomes, expenses, start, end);
    existing[1].bills[0].paid = true;
    const rebuilt = buildBudgets(incomes, [{ ...expenses[0], amount: 600 }], start, end, existing, { expense: { id: "rent", previousAmount: 400 } });
    expect(rebuilt[0].bills[0].paid).toBe(true);
    expect(rebuilt[0].bills[0].amount).toBe(600);
    expect(rebuilt[1].bills).toEqual([]);
  });

  it("keeps dates and expense series independent when paid occurrences move", () => {
    const series = [{ ...expenses[0], frequency: { value: 1, unit: "months" as const } }];
    const existing = buildBudgets(incomes, series, start, end);
    existing[1].bills.find(bill => dayKey(bill.expense.date) === "2026-11-12")!.paid = true;
    const rebuilt = buildBudgets([incomes[0]], [...series, { ...expenses[0], id: "other" }], start, end, existing);
    expect(rebuilt[0].bills).toHaveLength(3);
    expect(rebuilt[0].bills.map(bill => [bill.expense.id, dayKey(bill.expense.date), bill.paid])).toEqual(expect.arrayContaining([
      ["rent", "2026-11-12", true],
      ["other", "2026-11-12", false],
      ["rent", "2026-12-12", false],
    ]));
  });
});
