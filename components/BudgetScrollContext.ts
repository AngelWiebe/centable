import { createContext, type RefObject } from "react";

export type BudgetScrollControls = {
  listRef: RefObject<unknown>;
  setScrollEnabled: (enabled: boolean) => void;
};

/** Lets a row drag take the touch away from the budgets list. */
export const BudgetScrollContext = createContext<BudgetScrollControls | null>(
  null
);
