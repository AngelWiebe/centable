import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";
jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined), getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
}));
const incomes = [
  { id: "early", name: "Early", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined },
  { id: "late", name: "Late", amount: 500, date: new Date(2026, 10, 10), frequency: undefined },
];
const expenses = [{ id: "rent", name: "Rent", amount: 400, date: new Date(2026, 10, 12), frequency: undefined }];
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 17)); jest.clearAllMocks();
  useBudgetStore.setState({ incomes, expenses, ...buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2026, 10, 30)) });
});
afterEach(() => jest.useRealTimers());
it("reallocates automatic bills immediately when manual spending consumes the latest paycheck", async () => {
  const laterId = useBudgetStore.getState().budgets[1].id;
  await useBudgetStore.getState().addExpenseToBudget(laterId, { name: "Groceries", amount: 200, date: new Date(2026, 10, 11) });
  const [early, late] = useBudgetStore.getState().budgets;
  expect(early.bills[0].expense.id).toBe("rent"); expect(early.remainingBalance).toBe(600);
  expect(late.bills[0].expense.name).toBe("Groceries"); expect(late.remainingBalance).toBe(300);
  await useBudgetStore.getState().deleteExpenseFromBudget(laterId, late.bills[0].id);
  expect(useBudgetStore.getState().budgets[0].bills).toEqual([]);
  expect(useBudgetStore.getState().budgets[1].bills[0].expense.id).toBe("rent");
});
it("dismisses a generated occurrence while reallocating freed funds in the same save", async () => {
  const late = useBudgetStore.getState().budgets[1];
  await useBudgetStore.getState().deleteExpenseFromBudget(late.id, late.bills[0].id);
  expect(useBudgetStore.getState().budgets[1].bills).toEqual([]);
  expect(replaceAllBudgets).toHaveBeenLastCalledWith(expect.any(Array), [], { dismissExpense: { id: "rent", date: late.bills[0].expense.date } }, expect.anything());
});
it.each(["add", "remove"])("does not publish a failed manual %s", async action => {
  const before = useBudgetStore.getState();
  jest.mocked(replaceAllBudgets).mockRejectedValueOnce(new Error("disk full"));
  const late = before.budgets[1];
  const save = action === "add" ? before.addExpenseToBudget(late.id, { name: "Coffee", amount: 25, date: new Date(2026, 10, 11) })
    : before.deleteExpenseFromBudget(late.id, late.bills[0].id);
  await expect(save).rejects.toThrow("disk full");
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
});
