import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert, Platform } from "react-native";
import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import Reports from "../../app/(tabs)/reports";
import useBudgetStore from "../../store/useBudgetStore";
import { buildBudgetForecast } from "../../utils/buildBudgets";
import { makeExpense, makeIncome, testNow } from "../../test/fixtures";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@react-native-community/datetimepicker", () => "DatePicker");
jest.mock("react-native-chart-kit", () => ({ BarChart: "BarChart", PieChart: "PieChart" }));
jest.mock("react-native-keyboard-aware-scroll-view", () => ({ KeyboardAwareScrollView: "ScrollView" }));
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "/documents/", copyAsync: jest.fn(), getContentUriAsync: jest.fn() }));
jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn() }));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() }, Dimensions: { get: () => ({ width: 400 }) }, Platform: { OS: "ios" }, View: "View", Text: "Text", TouchableOpacity: "TouchableOpacity", StyleSheet: { create: (value: unknown) => value } }));
let root: TestRenderer.ReactTestRenderer;
let state: ReturnType<typeof useBudgetStore.getState>;
const texts = () => root.root.findAll(node => String(node.type) === "Text").map(node => node.children.join("")).join("\n");
async function press(text: string) {
  const button = root.root.findAll(node => String(node.type) === "TouchableOpacity").find(node => node.findAll(child => String(child.type) === "Text").some(child => child.children.join("").includes(text)))!;
  await act(async () => { await button.props.onPress(); });
}
beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(testNow()); jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "ios");
  jest.mocked(printToFileAsync).mockReset().mockResolvedValue({ uri: "/temp/report.pdf", numberOfPages: 1 });
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockReset().mockResolvedValue(undefined);
  jest.mocked(FileSystem.copyAsync).mockResolvedValue(undefined);
  const incomes = [makeIncome({ id: "old", date: new Date(2026, 9, 31) }), makeIncome({ date: new Date(2026, 10, 10) })];
  const expenses = [makeExpense({ date: new Date(2026, 10, 2) })];
  const forecast = buildBudgetForecast(incomes, expenses, new Date(2026, 9, 1), new Date(2026, 11, 31));
  state = { ...forecast, settings: { theme: "dark", currency: "CAD" } } as typeof state;
  jest.mocked(useBudgetStore).mockImplementation(selector => selector(state));
  await act(async () => { root = TestRenderer.create(<Reports />); });
});
afterEach(async () => { await act(async () => root.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
it("counts expenses by due date even when funded by an earlier month's income", () => {
  expect(texts()).toContain("Total Income: $1000.00");
  expect(texts()).toContain("Total Expenses: $100.00");
  expect(root.root.find(node => String(node.type) === "PieChart").props.data).toEqual([expect.objectContaining({ name: "Rent", amount: 100 })]);
});
it("shows unfunded expenses without requiring any income", async () => {
  state = { ...state, budgets: [], unfundedExpenses: [{ id: "rent", expense: makeExpense(), amount: 150, shortfall: 150, paid: false }] };
  await act(async () => root.update(<Reports />));
  expect(texts()).toContain("Unfunded expenses: $150.00");
  expect(texts()).toContain("Needs $150.00 more in one earlier budget.");
  expect(root.root.findAll(node => String(node.type) === "BarChart")).toHaveLength(0);
});
it("updates the report's date range and shows the empty state", async () => {
  await press("Start:");
  await act(async () => root.root.find(node => String(node.type) === "DatePicker").props.onChange({ type: "set" }, new Date(2026, 11, 1)));
  await press("End:");
  await act(async () => root.root.find(node => String(node.type) === "DatePicker").props.onChange({ type: "set" }, new Date(2026, 11, 31)));
  expect(texts()).toContain("No budgets available for the selected date range.");
  expect(root.root.findAll(node => String(node.type) === "PieChart")).toHaveLength(0);
});
it("exports the filtered report and shares the copied PDF", async () => {
  await press("Download Report as PDF");
  expect(printToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining("Rent"), base64: false });
  expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: "/temp/report.pdf", to: expect.stringMatching(/^\/documents\/Budget_Report_.*\.pdf$/) });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringContaining("/documents/Budget_Report_"), expect.objectContaining({ mimeType: "application/pdf" }));
});
it("reports a PDF generation failure without sharing a partial file", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(printToFileAsync).mockRejectedValueOnce(new Error("printer unavailable"));
  await press("Download Report as PDF");
  expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to generate PDF: printer unavailable");
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
it("opens an Android PDF with a content URI when sharing is unavailable", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
  jest.mocked(FileSystem.getContentUriAsync).mockResolvedValueOnce("content://report");
  await press("Download Report as PDF");
  expect(startActivityAsync).toHaveBeenCalledWith("android.intent.action.VIEW", { data: "content://report", flags: 1, type: "application/pdf" });
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
it("reports the saved file path when sharing is unavailable on iOS", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
  await press("Download Report as PDF");
  expect(Alert.alert).toHaveBeenCalledWith("Success", expect.stringContaining("/documents/Budget_Report_"));
});
