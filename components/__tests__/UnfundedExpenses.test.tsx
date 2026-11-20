import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import UnfundedExpenses from "../UnfundedExpenses";
import useBudgetStore from "../../store/useBudgetStore";

jest.mock("react-native", () => ({ Text: "span", View: "div", StyleSheet: { create: (styles: unknown) => styles } }));
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: jest.fn() }));

it("shows unfunded bills for the selected month with their amount and shortfall", async () => {
  jest.mocked(useBudgetStore).mockReturnValue({
    selectedMonth: 11, selectedYear: 2026, settings: { currency: "CAD", theme: "light" },
    unfundedExpenses: [
      { id: "rent", amount: 150, shortfall: 50, paid: true, expense: { name: "Rent", date: new Date(2026, 10, 2) } },
      { id: "future", amount: 100, shortfall: 100, paid: false, expense: { name: "Future bill", date: new Date(2026, 11, 2) } },
    ],
  });
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<UnfundedExpenses />); });
  const html = JSON.stringify(root.toJSON());
  expect(html).toContain("Unfunded expenses");
  expect(html).toContain("Rent");
  expect(html).toContain("150.00");
  expect(html).toContain("50.00");
  expect(html).toContain("Marked paid");
  expect(html).not.toContain("Future bill");
});

it("renders nothing when the selected month has no unfunded occurrences", async () => {
  jest.mocked(useBudgetStore).mockReturnValue({
    selectedMonth: 11, selectedYear: 2026, settings: null, unfundedExpenses: [],
  });
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<UnfundedExpenses />); });
  expect(root.toJSON()).toBeNull();
});
