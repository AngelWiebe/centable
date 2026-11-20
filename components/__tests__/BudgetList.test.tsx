import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo } from "react-native";
import BudgetList from "../BudgetList";
import useBudgetStore from "../../store/useBudgetStore";
import { buildBudgetForecast } from "../../utils/buildBudgets";
import { makeIncome, makeExpense, testNow } from "../../test/fixtures";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../BudgetItem", () => "BudgetItem");
jest.mock("../UnfundedExpenses", () => "UnfundedExpenses");
jest.mock("../BudgetDragContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { BudgetDragProvider: ({ children }: { children: React.ReactNode }) => children,
    BudgetDropTarget: "DropTarget", BudgetDragListContext: React.createContext({ onScroll: jest.fn(), onContentSizeChange: jest.fn() }) };
});
jest.mock("react-native-gesture-handler", () => ({ FlatList: "FlatList", GestureHandlerRootView: "Root" }));
jest.mock("react-native", () => ({ AccessibilityInfo: { announceForAccessibility: jest.fn() }, View: "View", Text: "Text", StyleSheet: { create: (value: unknown) => value } }));
let root: TestRenderer.ReactTestRenderer;
let state: ReturnType<typeof useBudgetStore.getState>;
const list = () => root.root.find(node => String(node.type) === "FlatList");
beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(testNow()); jest.clearAllMocks();
  const incomes = [makeIncome({ id: "old", date: new Date(2026, 8, 1) }), makeIncome({ id: "new", date: new Date(2026, 10, 20) }), makeIncome({ id: "future", date: new Date(2026, 11, 1) })];
  const forecast = buildBudgetForecast(incomes, [makeExpense()], new Date(2026, 8, 1), new Date(2026, 11, 31));
  state = { ...forecast, selectedMonth: 11, selectedYear: 2026, loadError: null, settings: { currency: "CAD", theme: "dark" } } as typeof state;
  jest.mocked(useBudgetStore).mockImplementation(selector => selector(state));
  await act(async () => { root = TestRenderer.create(<BudgetList />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
it("includes older carryover money funding this month's expenses and excludes future budgets", () => {
  expect(list().props.data.map((budget: { income: { id: string } }) => budget.income.id)).toEqual(["old", "new"]);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("2 budgets found for the selected month and year.");
  const card = list().props.renderItem({ item: state.budgets[0] });
  expect(card.props.budgetId).toBe(state.budgets[0].id);
  expect(card.props.children.props.budget).toBe(state.budgets[0]);
});
it("keeps unfunded expenses visible even when no income budgets exist", async () => {
  state = { ...state, budgets: [] };
  await act(async () => root.update(<BudgetList />));
  let header!: TestRenderer.ReactTestRenderer;
  await act(async () => { header = TestRenderer.create(list().props.ListHeaderComponent); });
  expect(header.root.findAll(node => String(node.type) === "UnfundedExpenses")).toHaveLength(1);
  expect(list().props.ListEmptyComponent).toBeDefined();
  await act(async () => header.unmount());
});
it("shows loading errors rather than a misleading empty-budget message", async () => {
  state = { ...state, budgets: [], loadError: "Unable to load saved budgets. Refresh to try again." };
  await act(async () => root.update(<BudgetList />));
  expect(list().props.ListEmptyComponent).toBeUndefined();
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith(state.loadError);
  const header = list().props.ListHeaderComponent;
  expect(header.props.children[0].props.children).toBe(state.loadError);
});
