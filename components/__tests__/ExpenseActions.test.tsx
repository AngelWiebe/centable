import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import ExpenseActions from "../ExpenseActions";
import useBudgetStore from "../../store/useBudgetStore";
import { buildBudgetForecast } from "../../utils/buildBudgets";
import { makeExpense, makeIncome, testNow } from "../../test/fixtures";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: Object.assign(jest.fn(), { getState: jest.fn() }) }));
jest.mock("react-native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { AccessibilityInfo: { announceForAccessibility: jest.fn() }, Alert: { alert: jest.fn() },
    FlatList: ({ data, renderItem }: { data: { id: string }[]; renderItem: (value: { item: { id: string } }) => React.ReactElement }) => React.createElement("List", null, data.map(item => React.cloneElement(renderItem({ item }), { key: item.id }))),
    View: "View", Text: "Text", TouchableOpacity: "Button", Modal: "Modal", StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 } };
});
let root: TestRenderer.ReactTestRenderer;
let state: ReturnType<typeof useBudgetStore.getState>;
let bill: ReturnType<typeof buildBudgetForecast>["budgets"][number]["bills"][number];
const move = jest.fn();
const reorder = jest.fn();
const button = (label: string) => root.root.find(node => String(node.type) === "Button" && node.props.accessibilityLabel === label);
async function press(label: string) { await act(async () => { await button(label).props.onPress(); }); }
const destinationButton = () => root.root.findAll(node => String(node.type) === "Button").find(node => node.props.accessibilityLabel?.startsWith("Move Rent to Earlier,"))!;
beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(testNow()); jest.clearAllMocks();
  move.mockReset().mockResolvedValue(undefined); reorder.mockReset().mockResolvedValue(true);
  const incomes = [makeIncome({ id: "earlier", name: "Earlier" }), makeIncome({ id: "later", date: new Date(2026, 10, 10) }), makeIncome({ id: "future", date: new Date(2026, 11, 1) })];
  const expenses = [makeExpense({ date: new Date(2026, 10, 12) })];
  const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 10, 1), new Date(2026, 11, 31));
  bill = forecast.budgets[1].bills[0];
  state = { ...forecast, selectedMonth: 11, selectedYear: 2026, settings: { currency: "CAD", theme: "dark" }, moveExpenseBetweenBudgets: move } as unknown as typeof state;
  jest.mocked(useBudgetStore).mockImplementation(selector => selector(state));
  jest.mocked(useBudgetStore.getState).mockImplementation(() => state);
  await act(async () => { root = TestRenderer.create(<ExpenseActions budgetId={forecast.budgets[1].id} bill={bill} index={0} count={2} onReorder={reorder} />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
it("offers labeled tap controls and disables moving past the first row", async () => {
  await press("Options for Rent");
  expect(button("Move Rent up").props.accessibilityState.disabled).toBe(true);
  expect(button("Move Rent down").props.accessibilityState.disabled).toBe(false);
  await press("Move Rent down");
  expect(reorder).toHaveBeenCalledWith(0, 1);
  expect(root.root.findAll(node => String(node.type) === "Modal")).toHaveLength(0);
});
it("keeps failed reorder options open for retry", async () => {
  reorder.mockResolvedValueOnce(false);
  await press("Options for Rent"); await press("Move Rent down");
  expect(root.root.findAll(node => String(node.type) === "Modal")).toHaveLength(1);
  await press("Move Rent down");
  expect(reorder).toHaveBeenCalledTimes(2);
});
it("offers only other budgets in the selected month and moves the selected occurrence", async () => {
  await press("Options for Rent"); await press("Move Rent to another budget");
  expect(root.root.findAll(node => String(node.type) === "List")[0].children).toHaveLength(1);
  await act(async () => { await destinationButton().props.onPress(); });
  expect(move).toHaveBeenCalledWith(state.budgets[1].id, state.budgets[0].id, "rent", bill.id, 100);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Moved Rent to another budget.");
});
it("shows save failures, keeps the chooser open and permits retry", async () => {
  move.mockRejectedValueOnce(new Error("disk full"));
  await press("Options for Rent"); await press("Move Rent to another budget");
  await act(async () => { await destinationButton().props.onPress(); });
  expect(Alert.alert).toHaveBeenCalledWith("Unable to move expense", expect.any(String));
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  await act(async () => { await destinationButton().props.onPress(); });
  expect(move).toHaveBeenCalledTimes(2);
});
it("blocks duplicate move requests while saving", async () => {
  let release!: () => void;
  move.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  await press("Options for Rent"); await press("Move Rent to another budget");
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => { const onPress = destinationButton().props.onPress; first = onPress(); second = onPress(); });
  expect(move).toHaveBeenCalledTimes(1);
  expect(destinationButton().props.accessibilityState).toEqual({ disabled: true, busy: true });
  await act(async () => { release(); await first; await second; });
});
it("cancels without changing the expense", async () => {
  await press("Options for Rent"); await press("Cancel expense options");
  expect(move).not.toHaveBeenCalled(); expect(reorder).not.toHaveBeenCalled();
});
