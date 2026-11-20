import { ExpenseInterface } from "./expense";
import { IncomeInterface } from "./income";

export interface StoredBudget {
  id: string;
  date: string;
  bills: {
    id: string;
    expense: ExpenseInterface;
    amount: number;
    sort_order: number;
    paid: boolean;
    assignmentOverride?: boolean;
    amountOverride?: boolean;
  }[];
  income: IncomeInterface;
  amount: number;
  remainingBalance: number;
  amountOverride?: boolean;
}

/** An occurrence for which no earlier income can cover the full amount. */
export interface UnfundedExpense {
  id: string;
  expense: ExpenseInterface;
  amount: number;
  paid: boolean;
  /** Extra funds needed in the best-funded eligible individual budget. */
  shortfall: number;
  amountOverride?: boolean;
}

export interface BudgetForecast {
  budgets: StoredBudget[];
  unfundedExpenses: UnfundedExpense[];
}
