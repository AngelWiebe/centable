import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets, getDismissedBudgetExpenseKeys } from "../../database/database";
import { dayKey } from "../occurrenceDates";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
}));

it("uses the income-aware forecast when rebuilding and saving budgets", async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 17, 12));
  try {
    jest.clearAllMocks();
    useBudgetStore.setState({
      incomes: [{ id: "pay", name: "Pay", amount: 3000, date: new Date(2027, 0, 1), frequency: { value: 3, unit: "months" } }],
      expenses: [{ id: "rent", name: "Rent", amount: 500, date: new Date(2027, 0, 5), frequency: { value: 1, unit: "months" } }],
      budgets: [],
    });
    await useBudgetStore.getState().refreshBudgets();
    const january = useBudgetStore.getState().budgets.find(budget => dayKey(budget.date) === "2027-01-01");
    expect(january?.bills.map(bill => dayKey(bill.expense.date))).toEqual(["2027-01-05", "2027-02-05", "2027-03-05"]);
    expect(getDismissedBudgetExpenseKeys).toHaveBeenCalled();
    expect(replaceAllBudgets).toHaveBeenCalledWith(useBudgetStore.getState().budgets, [], undefined, expect.anything());
  } finally {
    jest.useRealTimers();
  }
});

it("keeps saved budget details in memory after a failed replacement and preserves them on retry", async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 17, 12));
  try {
    jest.clearAllMocks();
    const incomes = [{ id: "pay", name: "Pay", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined }];
    const expenses = [{ id: "rent", name: "Rent", amount: 400, date: new Date(2026, 10, 2), frequency: undefined }];
    useBudgetStore.setState({ incomes, expenses, budgets: [] });
    await useBudgetStore.getState().refreshBudgets();
    const before = useBudgetStore.getState().budgets;
    before[0].amount = 1200;
    before[0].income.amount = 1200;
    before[0].bills[0].paid = true;
    before[0].bills[0].amount = 450;
    before[0].bills[0].expense.amount = 450;
    before[0].bills.push({ id: "manual", amount: 125, paid: true, sort_order: 1, expense: {
      id: "manual:manual", name: "Groceries", amount: 125, date: new Date(2026, 10, 3, 12), frequency: undefined,
    } });
    before[0].remainingBalance = 625;
    const snapshot = JSON.stringify(before);
    const failure = new Error("disk full");
    jest.mocked(replaceAllBudgets).mockRejectedValueOnce(failure);

    await expect(useBudgetStore.getState().refreshBudgets()).rejects.toBe(failure);
    expect(useBudgetStore.getState().budgets).toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);

    await useBudgetStore.getState().refreshBudgets();
    const rebuilt = useBudgetStore.getState().budgets;
    expect(rebuilt[0].amount).toBe(1200);
    expect(rebuilt[0].remainingBalance).toBe(625);
    expect(rebuilt[0].bills.map(bill => [bill.id, bill.amount, bill.paid])).toEqual(before[0].bills.map(bill => [bill.id, bill.amount, bill.paid]));
    expect(replaceAllBudgets).toHaveBeenLastCalledWith(rebuilt, [], undefined, expect.anything());
  } finally {
    jest.useRealTimers();
  }
});
