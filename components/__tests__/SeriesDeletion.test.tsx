import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import Incomes from "../../app/(tabs)/incomes";
import Expenses from "../../app/(tabs)/expenses";
import useBudgetStore from "../../store/useBudgetStore";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ MaterialIcons: "Icon" }));
jest.mock("../FinancialForm", () => "FinancialForm");
jest.mock("../ListItem", () => "ListItem");
jest.mock("@react-native-picker/picker", () => ({ Picker: Object.assign(() => null, { Item: () => null }) }));
jest.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: jest.fn() }, Platform: { OS: "ios" }, KeyboardAvoidingView: "KeyboardAvoidingView", Alert: { alert: jest.fn() }, FlatList: "FlatList", Text: "Text", View: "View", TouchableOpacity: "TouchableOpacity", TextInput: "TextInput", StyleSheet: { create: (styles: unknown) => styles },
}));
it.each([["income", Incomes], ["expense", Expenses]] as const)("reports a failed %s deletion and allows retry", async (kind, Screen) => {
  jest.clearAllMocks();
  const remove = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  const state = { incomes: [], expenses: [], deleteIncome: remove, deleteExpense: remove, getExpenses: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(useBudgetStore).mockImplementation((selector?: (value: ReturnType<typeof useBudgetStore.getState>) => unknown) => selector ? selector(state as unknown as ReturnType<typeof useBudgetStore.getState>) : state);
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<Screen />); });
  const list = root.root.find(node => String(node.type) === "FlatList");
  const row = list.props.renderItem({ item: { id: "entry" } });
  row.props.handleDelete("entry");
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;
  await act(async () => { await buttons.find(button => button.text === "Delete")!.onPress!(); });
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith(`Unable to delete ${kind}`, expect.any(String));
  await act(async () => { await buttons.find(button => button.text === "Delete")!.onPress!(); });
  expect(remove).toHaveBeenCalledTimes(2);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Item deleted");
  await act(async () => root.unmount());
});
