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
  }[];
  income: IncomeInterface;
  amount: number;
  remainingBalance: number;
}
