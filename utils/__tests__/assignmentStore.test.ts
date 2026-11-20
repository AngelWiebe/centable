import useBudgetStore from "../../store/useBudgetStore";
import { getBudgets, replaceAllBudgets, getIncomes, getExpenses } from "../../database/database";
import { buildBudgetForecast } from "../buildBudgets";

jest.mock("../../database/database", () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  replaceAllBudgets: jest.fn().mockResolvedValue(undefined),
  getDismissedBudgetExpenseKeys: jest.fn().mockResolvedValue([]),
  getIncomes: jest.fn(), getExpenses: jest.fn(), getBudgets: jest.fn(),
  getUnfundedExpenses: jest.fn().mockResolvedValue([]),
  getSettings: jest.fn().mockResolvedValue({ currency: "CAD", theme: "dark" }),
}));

it("keeps a manually moved occurrence on its destination through refresh and reload", async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 17, 12));
  try {
    const incomes = [
      { id: "earlier", name: "Earlier", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined },
      { id: "latest", name: "Latest", amount: 1000, date: new Date(2026, 10, 10), frequency: undefined },
    ];
    const expenses = [{ id: "rent", name: "Rent", amount: 400, date: new Date(2026, 10, 12), frequency: undefined }];
    const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 9, 1), new Date(2027, 1, 28));
    useBudgetStore.setState({ incomes, expenses, ...forecast });
    const [earlier, latest] = forecast.budgets;
    const row = latest.bills[0];
    await useBudgetStore.getState().moveExpenseBetweenBudgets(latest.id, earlier.id, "rent", row.id, 400);
    expect(replaceAllBudgets).toHaveBeenCalled();
    await useBudgetStore.getState().refreshBudgets();
    const saved = useBudgetStore.getState().budgets;
    expect(saved[0].bills[0]).toMatchObject({ id: row.id, assignmentOverride: true });
    expect(saved[1].bills).toEqual([]);
    expect(replaceAllBudgets).toHaveBeenLastCalledWith(saved, [], undefined, expect.anything());

    jest.mocked(getIncomes).mockResolvedValue(incomes);
    jest.mocked(getExpenses).mockResolvedValue(expenses);
    jest.mocked(getBudgets).mockResolvedValue(saved);
    useBudgetStore.setState({ budgets: [], incomes: [], expenses: [] });
    await useBudgetStore.getState().fetchAndCleanBudgets();
    expect(useBudgetStore.getState().budgets[0].bills[0]).toMatchObject({ id: row.id, assignmentOverride: true });
    expect(useBudgetStore.getState().budgets[1].bills).toEqual([]);
  } finally {
    jest.useRealTimers();
  }
});
