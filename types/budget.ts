import { ExpenseInterface } from "./expense";
import { IncomeInterface } from "./income";

export interface StoredBudget {
  id: string;
  date: string;
  bills: {
    expense: ExpenseInterface;
    paid: boolean;
  }[];
  income: IncomeInterface;
  remainingBalance: number;
}
