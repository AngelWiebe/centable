import { StoredBudget } from "../../types/budget";
import { buildBudgets } from "../buildBudgets";

const start = new Date(2026, 10, 1);
const end = new Date(2026, 10, 30);
const incomes = [
  { id: "earlier", name: "Earlier pay", date: new Date(2026, 10, 1), amount: 1000, frequency: undefined },
  { id: "latest", name: "Latest pay", date: new Date(2026, 10, 10), amount: 500, frequency: undefined },
];
const expenses = [{
  id: "rent", name: "Rent", date: new Date(2026, 10, 12), amount: 400,
  frequency: { value: 1, unit: "months" as const },
}];

const manualBill = (amount: number, paid: boolean): StoredBudget["bills"][number] => ({
  id: "manual-bill", amount, paid, sort_order: 0,
  expense: { id: "manual:manual-bill", name: "Groceries", date: new Date(2026, 10, 11, 12), amount, frequency: undefined },
});

describe("manual expenses reserve income before recurring allocation", () => {
  it.each([false, true])("falls back to an earlier budget when manual spending leaves insufficient funds (paid=%s)", paid => {
    const existing = buildBudgets(incomes, [], start, end);
    const manual = manualBill(200, paid);
    existing[1].bills.push(manual);
    existing[1].remainingBalance = 300;
    const before = JSON.stringify(existing);

    const rebuilt = buildBudgets(incomes, expenses, start, end, existing);
    expect(rebuilt[0].bills.map(bill => bill.expense.id)).toEqual(["rent"]);
    expect(rebuilt[0].remainingBalance).toBe(600);
    expect(rebuilt[1].bills).toEqual([manual]);
    expect(rebuilt[1].remainingBalance).toBe(300);
    expect(JSON.stringify(existing)).toBe(before);

    const rebuiltAgain = buildBudgets(incomes, expenses, start, end, rebuilt);
    expect(rebuiltAgain).toEqual(rebuilt);
  });

  it("keeps a recurring expense on the latest income when the reserved balance covers it exactly", () => {
    const existing = buildBudgets(incomes, [], start, end);
    existing[1].bills.push(manualBill(100, false));
    existing[1].remainingBalance = 400;

    const rebuilt = buildBudgets(incomes, expenses, start, end, existing);
    expect(rebuilt[0].bills).toEqual([]);
    expect(rebuilt[0].remainingBalance).toBe(1000);
    expect(rebuilt[1].bills.map(bill => bill.expense.id)).toEqual(["manual:manual-bill", "rent"]);
    expect(rebuilt[1].remainingBalance).toBe(0);
  });
});
