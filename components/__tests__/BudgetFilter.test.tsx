import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import BudgetFilter from "../BudgetFilter";
import useBudgetStore from "../../store/useBudgetStore";
jest.mock("@expo/vector-icons", () => ({ MaterialIcons: "Icon" }));
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: jest.fn() }, Alert: { alert: jest.fn() },
  ActivityIndicator: "ActivityIndicator", Modal: "Modal", Pressable: "Pressable", Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View", StyleSheet: { create: (styles: unknown) => styles },
}));
it("shows refresh failures without announcing success and permits retry", async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  jest.mocked(useBudgetStore).mockReturnValue({ selectedMonth: 11, selectedYear: 2026, settings: { theme: "dark" }, refreshBudgets: refresh });
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<BudgetFilter />); });
  const refreshButton = () => root.root.findAll(node => String(node.type) === "TouchableOpacity").find(node => node.props.disabled !== undefined)!;
  await act(async () => { await refreshButton().props.onPress(); });
  expect(Alert.alert).toHaveBeenCalledWith("Unable to refresh budgets", expect.any(String));
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith("Budgets recalculated.");
  expect(refreshButton().props.disabled).toBe(false);
  expect(refreshButton().props.accessibilityLabel).toBe("Refresh budgets");
  expect(refreshButton().props.accessibilityRole).toBe("button");
  expect(refreshButton().props.accessibilityState).toEqual({ disabled: false, busy: false });
  await act(async () => { await refreshButton().props.onPress(); });
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("Budgets recalculated.");
});
