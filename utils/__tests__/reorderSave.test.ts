import useBudgetStore from "../../store/useBudgetStore";
import { updateExpenseOrderInDB } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";
jest.mock("../../database/database", () => ({ setupDatabase: jest.fn().mockResolvedValue(undefined), updateExpenseOrderInDB: jest.fn().mockResolvedValue(undefined) }));
beforeEach(() => {
  jest.clearAllMocks();
  const date = new Date(2026, 10, 1);
  const incomes = [{ id: "pay", name: "Pay", amount: 1000, date, frequency: undefined }];
  const expenses = ["A", "B"].map(id => ({ id, name: id, amount: 100, date, frequency: undefined }));
  useBudgetStore.setState({ incomes, expenses, ...buildBudgetForecast(incomes, expenses, date, new Date(2026, 10, 30)) });
});
it("keeps the saved order when persistence rejects", async () => {
  const before = useBudgetStore.getState().budgets;
  jest.mocked(updateExpenseOrderInDB).mockRejectedValueOnce(new Error("disk full"));
  await expect(useBudgetStore.getState().updateExpenseOrder(before[0].id, [...before[0].bills].reverse())).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(before);
});
it("uses current bill details when applying a requested order", async () => {
  const budget = useBudgetStore.getState().budgets[0];
  const order = [...budget.bills].reverse();
  useBudgetStore.setState({ budgets: [{ ...budget, bills: budget.bills.map(bill => ({ ...bill, paid: true })) }] });
  await useBudgetStore.getState().updateExpenseOrder(budget.id, order);
  const bills = useBudgetStore.getState().budgets[0].bills;
  expect(bills.map(bill => bill.expense.id)).toEqual(["B", "A"]);
  expect(bills.every(bill => bill.paid)).toBe(true);
});
it("rejects duplicate or stale requested rows before writing", async () => {
  const budget = useBudgetStore.getState().budgets[0];
  await expect(useBudgetStore.getState().updateExpenseOrder(budget.id, [budget.bills[0], budget.bills[0]])).rejects.toThrow("stale");
  expect(updateExpenseOrderInDB).not.toHaveBeenCalled();
});
