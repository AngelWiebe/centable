import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";

export function makeIncome(overrides: Partial<IncomeInterface> = {}): IncomeInterface {
  return { id: "pay", name: "Pay", amount: 1000, date: new Date(2026, 10, 1), frequency: undefined, ...overrides };
}

export function makeExpense(overrides: Partial<ExpenseInterface> = {}): ExpenseInterface {
  return { id: "rent", name: "Rent", amount: 100, date: new Date(2026, 10, 2), frequency: undefined, ...overrides };
}

export function testNow(hour = 0): Date {
  return new Date(2026, 10, 17, hour);
}
