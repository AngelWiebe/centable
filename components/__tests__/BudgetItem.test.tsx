import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import BudgetItem from "../BudgetItem";
import useBudgetStore from "../../store/useBudgetStore";
import { buildBudgetForecast } from "../../utils/buildBudgets";
import { makeExpense, makeIncome } from "../../test/fixtures";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ MaterialIcons: "Icon" }));
jest.mock("@react-native-community/datetimepicker", () => "DatePicker");
jest.mock("../ExpenseActions", () => "ExpenseActions");
jest.mock("../DraggableExpenseRow", () => "DragRow");
jest.mock("react-native", () => ({ AccessibilityInfo: { announceForAccessibility: jest.fn() }, Alert: { alert: jest.fn() }, View: "View", Text: "Text", TextInput: "TextInput", TouchableOpacity: "TouchableOpacity", StyleSheet: { create: (value: unknown) => value } }));
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { useSharedValue: (value: number) => React.useRef({ value, set(next: number) { this.value = next; } }).current };
});
const actions = { addExpenseToBudget: jest.fn(), deleteExpenseFromBudget: jest.fn(), updateExpenseOrder: jest.fn(), updateExpenseAmount: jest.fn(), updateIncomeAmount: jest.fn(), toggleExpensePaid: jest.fn() };
const forecast = () => buildBudgetForecast([makeIncome()], [makeExpense(), makeExpense({ id: "food", name: "Food", amount: 50 })], new Date(2026, 10, 1), new Date(2026, 10, 30));
let root: TestRenderer.ReactTestRenderer;
let budget: ReturnType<typeof forecast>["budgets"][number];
const host = (type: string) => root.root.findAll(node => String(node.type) === type);
const labeled = (label: string) => root.root.find(node => node.props.accessibilityLabel === label && typeof node.type === "string");
async function press(label: string) { await act(async () => { await labeled(label).props.onPress(); }); }
const input = () => host("TextInput").find(node => node.props.placeholder === "Enter amount")!;
async function changeAmount(text: string) { await act(async () => input().props.onChangeText(text)); }
async function addDraft() {
  await press("Add an expense to this budget");
  await act(async () => { labeled("Expense title").props.onChangeText("  Coffee  "); labeled("Expense amount").props.onChangeText("12.34"); });
}
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  Object.values(actions).forEach(action => action.mockReset().mockResolvedValue(undefined));
  budget = forecast().budgets[0];
  jest.mocked(useBudgetStore).mockReturnValue({ ...actions, settings: { theme: "dark", currency: "CAD" } });
  await act(async () => { root = TestRenderer.create(<BudgetItem budget={budget} />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
it("saves an edited expense using its occurrence row ID", async () => {
  await press("Expense amount $100.00, tap to edit");
  await changeAmount("125.50");
  await act(async () => { await input().props.onSubmitEditing(); });
  expect(actions.updateExpenseAmount).toHaveBeenCalledWith(budget.id, budget.bills[0].id, 125.5);
  expect(host("TextInput")).toHaveLength(0);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Expense updated to $125.50");
});
it("retains the expense editor and draft when saving fails", async () => {
  actions.updateExpenseAmount.mockRejectedValueOnce(new Error("disk full"));
  await press("Expense amount $100.00, tap to edit"); await changeAmount("120");
  await act(async () => { await input().props.onBlur(); });
  expect(input().props.value).toBe("120");
  expect(Alert.alert).toHaveBeenCalledWith("Unable to save expense", expect.any(String));
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
});
it.each([false, true])("saves income edits and handles failure=%s", async fail => {
  if (fail) actions.updateIncomeAmount.mockRejectedValueOnce(new Error("disk full"));
  const incomeButton = labeled("Income amount for Pay, tap to edit");
  await act(async () => incomeButton.props.onPress()); await changeAmount("1100.25");
  await act(async () => { await input().props.onSubmitEditing(); });
  expect(actions.updateIncomeAmount).toHaveBeenCalledWith(budget.id, 1100.25);
  if (fail) { expect(input().props.value).toBe("1100.25"); expect(Alert.alert).toHaveBeenCalledWith("Unable to save income", expect.any(String)); }
  else expect(host("TextInput")).toHaveLength(0);
});
it.each([false, true])("toggles paid status and handles failure=%s", async fail => {
  if (fail) actions.toggleExpensePaid.mockRejectedValueOnce(new Error("disk full"));
  const button = host("TouchableOpacity").find(node => node.findAll(child => String(child.type) === "Icon" && child.props.name === "radio-button-unchecked").length)!;
  await act(async () => { await button.props.onPress(); });
  expect(actions.toggleExpensePaid).toHaveBeenCalledWith(budget.id, budget.bills[0].id, true);
  if (fail) { expect(Alert.alert).toHaveBeenCalledWith("Unable to save payment status", expect.any(String)); expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled(); }
  else expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(expect.stringContaining("marked as paid"));
});
it.each([false, true])("deletes only after confirmation and handles failure=%s", async fail => {
  if (fail) actions.deleteExpenseFromBudget.mockRejectedValueOnce(new Error("disk full"));
  await press("Delete Rent");
  expect(actions.deleteExpenseFromBudget).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => { await buttons.find(button => button.text === "Delete")!.onPress!(); });
  expect(actions.deleteExpenseFromBudget).toHaveBeenCalledWith(budget.id, budget.bills[0].id);
  if (fail) { expect(Alert.alert).toHaveBeenLastCalledWith("Unable to delete expense", expect.any(String)); expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled(); }
  else expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Deleted expense Rent");
});
it("validates new expenses, trims names and saves the chosen date", async () => {
  await press("Add an expense to this budget"); await press("Save expense on this budget");
  expect(actions.addExpenseToBudget).not.toHaveBeenCalled();
  await act(async () => { labeled("Expense title").props.onChangeText("  Coffee  "); labeled("Expense amount").props.onChangeText("12.34"); });
  await press("Expense date");
  const date = new Date(2026, 10, 18);
  await act(async () => host("DatePicker")[0].props.onChange({ type: "set" }, date));
  await press("Save expense on this budget");
  expect(actions.addExpenseToBudget).toHaveBeenCalledWith(budget.id, { name: "Coffee", amount: 12.34, date });
  expect(host("TextInput")).toHaveLength(0);
});
it("keeps a failed add draft available for retry", async () => {
  actions.addExpenseToBudget.mockRejectedValueOnce(new Error("disk full"));
  await addDraft(); await press("Save expense on this budget");
  expect(labeled("Expense title").props.value).toBe("  Coffee  ");
  expect(Alert.alert).toHaveBeenCalledWith("Unable to add expense", expect.any(String));
  await press("Save expense on this budget");
  expect(actions.addExpenseToBudget).toHaveBeenCalledTimes(2);
});
it("cancels adding without saving and resets the draft when reopened", async () => {
  await addDraft(); await press("Cancel adding expense"); await press("Add an expense to this budget");
  expect(labeled("Expense title").props.value).toBe("");
  expect(labeled("Expense amount").props.value).toBe("");
  expect(actions.addExpenseToBudget).not.toHaveBeenCalled();
});
it.each([false, true])("saves a drag reorder and handles failure=%s", async fail => {
  if (fail) actions.updateExpenseOrder.mockRejectedValueOnce(new Error("disk full"));
  await act(async () => { await host("DragRow")[0].props.onReorder(0, 1); });
  expect(actions.updateExpenseOrder).toHaveBeenCalledWith(budget.id, [budget.bills[1], budget.bills[0]]);
  if (fail) expect(Alert.alert).toHaveBeenCalledWith("Unable to save order", expect.any(String));
  else expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Expenses reordered successfully.");
});

it("exposes payment state and keeps each expense control separately accessible", async () => {
  expect(labeled("Paid status for Rent").props.accessibilityRole).toBe("checkbox");
  expect(labeled("Paid status for Rent").props.accessibilityState.checked).toBe(false);
  let ancestor = labeled("Delete Rent").parent;
  while (ancestor) {
    if (String(ancestor.type) === "View") expect(ancestor.props.accessible).not.toBe(true);
    ancestor = ancestor.parent;
  }
  budget = { ...budget, bills: budget.bills.map(bill => ({ ...bill, paid: true })) };
  await act(async () => root.update(<BudgetItem budget={budget} />));
  expect(labeled("Paid status for Rent").props.accessibilityState.checked).toBe(true);
});
