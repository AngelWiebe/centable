import useBudgetStore from "../../store/useBudgetStore";
import { replaceAllBudgets } from "../../database/database";
jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined), replaceAllBudgets: jest.fn().mockResolvedValue(undefined), getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
}));
beforeEach(() => { jest.clearAllMocks(); useBudgetStore.setState({ incomes: [], expenses: [], budgets: [], unfundedExpenses: [], settings: { currency: "CAD", theme: "dark" } }); });
it.each(["income", "expense"] as const)("rejects hidden fractional cents in a new %s before persisting", async kind => {
  const before = useBudgetStore.getState();
  const payload = { id: "entry", name: "Entry", amount: 12.345, date: new Date(), frequency: undefined };
  const save = kind === "income" ? before.addOrUpdateIncome(payload) : before.addOrUpdateExpense(payload);
  await expect(save).rejects.toThrow("decimal places");
  expect(replaceAllBudgets).not.toHaveBeenCalled();
  expect(useBudgetStore.getState().budgets).toBe(before.budgets);
});
it("validates whole-unit currency amounts at the persistence boundary", async () => {
  useBudgetStore.setState({ settings: { currency: "JPY", theme: "dark" } });
  await expect(useBudgetStore.getState().addOrUpdateIncome({ name: "Pay", amount: 100.5, date: new Date() })).rejects.toThrow("decimal places");
  expect(replaceAllBudgets).not.toHaveBeenCalled();
});
