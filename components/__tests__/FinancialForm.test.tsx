import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import FinancialForm from "../FinancialForm";
import useBudgetStore from "../../store/useBudgetStore";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("@react-native-picker/picker", () => ({ Picker: Object.assign(jest.fn(() => null), { Item: "PickerItem" }) }));
jest.mock("react-native-keyboard-aware-scroll-view", () => ({ KeyboardAwareScrollView: "ScrollView" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: jest.fn() }, Alert: { alert: jest.fn() },
  Keyboard: { addListener: jest.fn(() => ({ remove: jest.fn() })) }, Platform: { OS: "ios", select: (options: Record<string, unknown>) => options.ios },
  Text: "Text", TextInput: "TextInput", Switch: "Switch", TouchableOpacity: "TouchableOpacity", View: "View", StyleSheet: { create: (styles: unknown) => styles },
}));
let root: TestRenderer.ReactTestRenderer;
async function renderForm(submit: () => Promise<void>) {
  await act(async () => {
    root = TestRenderer.create(<FinancialForm
      formData={{ name: "Salary", amount: 1000, date: new Date(2026, 10, 1), frequency: { value: 1, unit: "months" } }}
      setFormData={jest.fn()} isEditing={false} handleSubmit={submit} showDatePicker={false}
      setShowDatePicker={jest.fn()} resetForm={jest.fn()} handleDateChange={jest.fn()}
    />);
  });
}
function submitButton() { return root.root.findAll(node => String(node.type) === "TouchableOpacity").find(node => node.props.accessibilityState?.busy !== undefined)!; }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(useBudgetStore).mockReturnValue({ settings: { theme: "dark" } }); });
afterEach(async () => { if (root) await act(async () => root.unmount()); });
it("blocks two submit presses in the same frame and stays disabled until saving completes", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = jest.fn(() => gate);
  await renderForm(save);
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => {
    const press = submitButton().props.onPress;
    first = press(); second = press();
    await Promise.resolve();
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(submitButton().props.disabled).toBe(true);
  await act(async () => { release(); await first; await second; });
  expect(submitButton().props.disabled).toBe(false);
});
it("shows a save error and allows retry", async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  await renderForm(save);
  await act(async () => { await submitButton().props.onPress(); });
  expect(Alert.alert).toHaveBeenCalledWith("Unable to save entry", expect.any(String));
  expect(submitButton().props.disabled).toBe(false);
  await act(async () => { await submitButton().props.onPress(); });
  expect(save).toHaveBeenCalledTimes(2);
});

it.each(["12.3.4", "1.234"])("does not submit malformed or over-precision amount %s", async text => {
  const save = jest.fn().mockResolvedValue(undefined);
  await renderForm(save);
  const amountInput = () => root.root.findAll(node => String(node.type) === "TextInput").find(node => node.props.placeholder === "Enter amount")!;
  await act(async () => { amountInput().props.onChangeText(text); });
  await act(async () => { amountInput().props.onBlur(); });
  expect(amountInput().props.value).toBe(text);
  await act(async () => { await submitButton().props.onPress(); });
  expect(save).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith("Invalid amount", expect.any(String));
});
it("saves the same normalized amount that the input displays", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await renderForm(save);
  const amountInput = () => root.root.findAll(node => String(node.type) === "TextInput").find(node => node.props.placeholder === "Enter amount")!;
  await act(async () => { amountInput().props.onChangeText("1.2"); });
  await act(async () => { amountInput().props.onBlur(); });
  expect(amountInput().props.value).toBe("1.20");
  await act(async () => { await submitButton().props.onPress(); });
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ amount: 1.2 }));
});

it("gives populated inputs and the one-time switch persistent accessible names", async () => {
  await renderForm(jest.fn().mockResolvedValue(undefined));
  const inputs = root.root.findAll(node => String(node.type) === "TextInput");
  expect(inputs.map(node => node.props.accessibilityLabel)).toEqual(["Name", "Amount", "Repeat every"]);
  const toggle = () => root.root.find(node => String(node.type) === "Switch");
  expect(toggle().props.accessibilityLabel).toBe("One-Time Occurrence");
  expect(toggle().props.accessibilityState.checked).toBe(false);
  await act(async () => toggle().props.onValueChange(true));
  expect(toggle().props.accessibilityState.checked).toBe(true);
});
