import { useEffect } from "react";
import { AppState } from "react-native";
import useBudgetStore from "../store/useBudgetStore";
import { VISIBLE_BUDGET_MONTHS } from "../utils/buildBudgets";

/** Keep the forecast current across background sessions and calendar changes. */
export function useBudgetCalendarRefresh() {
  useEffect(() => {
    const monthKey = () => new Date().getFullYear() * 12 + new Date().getMonth();
    let refreshedMonth = monthKey();
    let refreshing = false;
    let disposed = false;
    let previousState = AppState.currentState;
    const refresh = async (force = false) => {
      const currentMonth = monthKey();
      if (refreshing || (!force && currentMonth === refreshedMonth)) return;
      refreshing = true;
      try {
        await useBudgetStore.getState().refreshBudgets();
        if (disposed) return;
        refreshedMonth = currentMonth;
        const { selectedMonth, selectedYear } = useBudgetStore.getState();
        const selected = selectedYear * 12 + selectedMonth - 1;
        if (selected < currentMonth - 1 || selected >= currentMonth - 1 + VISIBLE_BUDGET_MONTHS) {
          const now = new Date();
          useBudgetStore.setState({ selectedMonth: now.getMonth() + 1, selectedYear: now.getFullYear() });
        }
      } catch {
        if (!disposed) useBudgetStore.setState({ loadError: "Unable to refresh budgets. Refresh to try again." });
      } finally {
        refreshing = false;
      }
    };
    const subscription = AppState.addEventListener("change", state => {
      const returned = state === "active" && previousState !== "active";
      previousState = state;
      if (returned) void refresh(true);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 60_000);
    return () => { disposed = true; clearInterval(timer); subscription.remove(); };
  }, []);
}
