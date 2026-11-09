import { createContext, type RefObject } from "react";

/** Ref to the budgets list, so a row drag can take the touch from scrolling. */
export const BudgetScrollContext =
  createContext<RefObject<unknown> | null>(null);
