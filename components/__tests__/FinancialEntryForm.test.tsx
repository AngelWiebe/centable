import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useFinancialEntryForm } from "../../hooks/useFinancialEntryForm";
import { makeIncome } from "../../test/fixtures";
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));
let form: ReturnType<typeof useFinancialEntryForm>;
const save = jest.fn();
const remove = jest.fn();
function Entry() {
  const currentForm = useFinancialEntryForm("income", save, remove);
  useEffect(() => { form = currentForm; });
  return null;
}
it("keeps the draft after a failed save and closes it after a successful retry", async () => {
  save.mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<Entry />); });
  const income = makeIncome();
  await act(async () => { form.handleEdit(income); });
  expect(form.isEditing).toBe(true);
  await act(async () => { await expect(form.handleSubmit(income)).rejects.toThrow("disk full"); });
  expect(form.formData).toEqual(income);
  expect(form.showForm).toBe(true);
  await act(async () => { await form.handleSubmit(income); });
  expect(form.formData).toEqual({});
  expect(form.showForm).toBe(false);
  expect(form.isEditing).toBe(false);
  await act(async () => root.unmount());
});
