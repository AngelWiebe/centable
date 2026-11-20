import React from "react";
import TestRenderer, { act } from "react-test-renderer";
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
it("waits for the latest query and cancels pending work on unmount", async () => {
  jest.useFakeTimers();
  try {
    const expenses = [
      { id: "rent", name: "Rent", date: new Date(), amount: 100 },
      { id: "food", name: "Food", date: new Date(), amount: 50 },
    ];
    const state = { expenses, getExpenses: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(useBudgetStore).mockImplementation(selector => selector(state as unknown as ReturnType<typeof useBudgetStore.getState>));
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => { root = TestRenderer.create(<Expenses />); });
    const input = () => root.root.find(node => String(node.type) === "TextInput");
    const results = () => root.root.find(node => String(node.type) === "FlatList").props.data;
    await act(async () => { input().props.onChangeText("r"); });
    await act(async () => { jest.advanceTimersByTime(200); input().props.onChangeText("food"); });
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(results()).toHaveLength(2);
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(results().map((entry: { id: string }) => entry.id)).toEqual(["food"]);
    const schedule = jest.spyOn(globalThis, "setTimeout");
    const cancel = jest.spyOn(globalThis, "clearTimeout");
    await act(async () => { input().props.onChangeText("rent"); });
    const searchTimerIndex = schedule.mock.calls.findIndex(([, delay]) => delay === 300);
    expect(searchTimerIndex).toBeGreaterThanOrEqual(0);
    const searchTimer = schedule.mock.results[searchTimerIndex].value;
    await act(async () => root.unmount());
    expect(cancel).toHaveBeenCalledWith(searchTimer);
    schedule.mockRestore();
    cancel.mockRestore();
  } finally { jest.useRealTimers(); }
});
