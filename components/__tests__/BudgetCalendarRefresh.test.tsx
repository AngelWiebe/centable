import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState } from "react-native";
import useBudgetStore from "../../store/useBudgetStore";
import { useBudgetCalendarRefresh } from "../../hooks/useBudgetCalendarRefresh";
jest.mock("../../store/useBudgetStore", () => ({ __esModule: true, default: { getState: jest.fn(), setState: jest.fn() } }));
jest.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: jest.fn() } }));
function Calendar() { useBudgetCalendarRefresh(); return null; }
let root: TestRenderer.ReactTestRenderer;
const refresh = jest.fn();
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 30, 23, 59, 30));
  jest.clearAllMocks(); refresh.mockReset().mockResolvedValue(undefined);
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove });
  jest.mocked(useBudgetStore.getState).mockReturnValue({ refreshBudgets: refresh, selectedMonth: 10, selectedYear: 2026 } as unknown as ReturnType<typeof useBudgetStore.getState>);
});
afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); });
it("refreshes at month rollover, repairs an expired selection and removes listeners", async () => {
  await act(async () => { root = TestRenderer.create(<Calendar />); });
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(useBudgetStore.setState).toHaveBeenCalledWith({ selectedMonth: 12, selectedYear: 2026 });
  await act(async () => { jest.advanceTimersByTime(60_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  expect(remove).toHaveBeenCalled();
});
it("refreshes on returning to the app and exposes failures for retry", async () => {
  await act(async () => { root = TestRenderer.create(<Calendar />); });
  const listener = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  refresh.mockRejectedValueOnce(new Error("offline"));
  await act(async () => { listener("background"); listener("active"); });
  expect(useBudgetStore.setState).toHaveBeenCalledWith({ loadError: expect.stringContaining("Refresh to try again") });
  await act(async () => { listener("background"); listener("active"); });
  expect(refresh).toHaveBeenCalledTimes(2);
});
