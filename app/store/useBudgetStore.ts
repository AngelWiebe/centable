import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";

import { IncomeInterface } from "../../types/income";
import { ExpenseInterface } from "../../types/expense";
import { FrequencyUnit, FrequencyInterface } from "../../types/frequency";
import { StoredBudget } from "../../types/budget";

const INCOMES_KEY = "incomes";
const EXPENSES_KEY = "expenses";
const BUDGETS_KEY = "budgets";

type Bill = StoredBudget["bills"][number];

interface BudgetState {
  incomes: IncomeInterface[];
  expenses: ExpenseInterface[];
  budgets: StoredBudget[];
  loading: boolean;
  selectedMonth: number;
  selectedYear: number;
  recalculateBudgets: () => void;
  setIncomes: (incomes: IncomeInterface[]) => void;
  setExpenses: (expenses: ExpenseInterface[]) => void;
  setBudgets: (budgets: StoredBudget[]) => void;
  setLoading: (loading: boolean) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  fetchAndCleanBudgets: () => Promise<void>;
  saveBudget: () => Promise<void>;
  addOrUpdateIncome: (
    incomeForm: Partial<IncomeInterface>,
    frequency: { value: number; unit: FrequencyUnit } | undefined,
    isEditing: boolean
  ) => void;
  addOrUpdateExpense: (
    expenseForm: Partial<ExpenseInterface>,
    frequency: { value: number; unit: FrequencyUnit }  | undefined,
    isEditing: boolean
  ) => void;
  deleteExpense: (id: string) => void;
  deleteIncome: (id: string) => void;
  deleteExpenseFromBudget: (id: string, budgetId: string) => void;
  saveIncomes: () => Promise<void>;
  saveExpenses: () => Promise<void>;
  loadIncomes: () => Promise<void>;
  loadExpenses: () => Promise<void>;
  saveBudgets: () => Promise<void>;
  loadBudgets: () => Promise<void>;
  updateExpenseAmount: (budgetId: string, expenseId: string, newAmount: number) => Promise<void>;
  updateIncomeAmount: (budgetId: string, newAmount: number) => Promise<void>;
  updateExpenseOrder: (budgetId: string, newOrder: any[]) => Promise<void>;
  setPaidStatusInStorage: (budgetId: string, expenseId: string, isPaid: boolean) => Promise<void>;
  getPaidStatusFromStorage: (budgetId: string, expenseId: string) => Promise<boolean>;
  toggleExpensePaid: (budgetId: string, expenseId: string) => void;
  moveExpenseBetweenBudgets: (fromBudgetId: string, toBudgetId: string, expenseId: string) => void;
}

const useBudgetStore = create<BudgetState>((set, get) => {
  const manualUpdates = {
    incomes: new Map<string, number>(),
    expenses: new Map<string, number>(),
  };

  return {
    incomes: [],
    expenses: [],
    budgets: [],
    loading: false,
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),

    setIncomes: (incomes) => set({ incomes }),
    setExpenses: (expenses) => set({ expenses }),
    setBudgets: (budgets) => set({ budgets }),
    setLoading: (loading) => set({ loading }),
    setSelectedMonth: (month) => set({ selectedMonth: month }),
    setSelectedYear: (year) => set({ selectedYear: year }),
    fetchAndCleanBudgets: async () => {
      set({ loading: true });
      try {
        await get().loadIncomes();
        await get().loadExpenses();
        await get().loadBudgets();
      } catch (error) {
        console.error("Failed to fetch and clean budgets:", error);
      } finally {
        set({ loading: false });
      }
    },
  
    updateExpenseOrder: async (budgetId: string, newOrder: ExpenseInterface[]) => {
      const { budgets, setBudgets } = get();
    
      const updatedBudgets = budgets.map((budget) => {
        if (budget.id === budgetId) {
          const reorderedBills = newOrder.map((expense) => {
            const bill = budget.bills.find((bill) => bill.expense.id === expense.id);
            return bill ? { ...bill } : null;
          }).filter((bill) => bill !== null) as StoredBudget["bills"]; // Ensure non-null
    
          return {
            ...budget,
            bills: reorderedBills,
          };
        }
        return budget;
      });
    
      setBudgets(updatedBudgets);
    },    
    
    updateExpenseAmount: async (budgetId, expenseId, newAmount) => {
      const { budgets, setBudgets } = get();
      manualUpdates.expenses.set(expenseId, newAmount);
    
      const updatedBudgets = budgets.map((budget) => {
        if (budget.id === budgetId) {
          const updatedBills = budget.bills.map((bill) => {
            if (bill.expense.id === expenseId) {
                            return {
                ...bill,
                expense: {
                  ...bill.expense,
                  amount: newAmount,
                },
              };
            }
            return bill;
          });
    
          return {
            ...budget,
            bills: updatedBills,
          };
        }
        return budget;
      });
    
      setBudgets(updatedBudgets);
    },    

    updateIncomeAmount: async (budgetId, newAmount) => {
      const { budgets, setBudgets } = get();

      const budget = budgets.find((b) => b.id === budgetId);
      if (budget) {
        manualUpdates.incomes.set(budget.income.id, newAmount);
      }

      const updatedBudgets = budgets.map((budget) => {
        if (budget.id === budgetId) {
          return {
            ...budget,
            income: {
              ...budget.income,
              amount: newAmount,
            },
          };
        }
        return budget;
      });

      setBudgets(updatedBudgets);
    },

    saveBudget: async () => {
      set({ loading: true });
      try {
        await Promise.all([get().saveIncomes(), get().saveExpenses(), get().saveBudgets()]);
      } catch (error) {
        console.error("Failed to save budgets:", error);
      } finally {
        set({ loading: false });
      }
    },

    saveIncomes: async () => {
      await AsyncStorage.setItem(INCOMES_KEY, JSON.stringify(get().incomes));
    },

    saveExpenses: async () => {
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(get().expenses));
    },

    saveBudgets: async () => {
      await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(get().budgets));
    },

    loadIncomes: async () => {
      const incomesData = await AsyncStorage.getItem(INCOMES_KEY);
      if (incomesData) set({ incomes: JSON.parse(incomesData) });
    },

    loadExpenses: async () => {
      const expensesData = await AsyncStorage.getItem(EXPENSES_KEY);
      if (expensesData) set({ expenses: JSON.parse(expensesData) });
    },

    loadBudgets: async () => {
      const budgetsData = await AsyncStorage.getItem(BUDGETS_KEY);
      if (budgetsData) set({ budgets: JSON.parse(budgetsData) });
    },

    deleteExpense: (id) => {
      const updatedExpenses = get().expenses.filter(expense => expense.id !== id);
      get().setExpenses(updatedExpenses);
      get().recalculateBudgets();
    },

    deleteIncome: (id) => {
      const updatedIncomes = get().incomes.filter(income => income.id !== id);
      get().setIncomes(updatedIncomes);
      get().recalculateBudgets();
    },

    deleteExpenseFromBudget: (id, budgetId) => {
      const { budgets, setBudgets, recalculateBudgets } = get();
      const updatedBudgets = budgets.map((budget) =>
        budget.id === budgetId
          ? { ...budget, bills: budget.bills.filter(bill => bill.expense.id !== id) }
          : budget
      );

      setBudgets(updatedBudgets);
      recalculateBudgets();
    },

    setPaidStatusInStorage: async (budgetId, expenseId, isPaid) => {
      const key = `paidStatus-${budgetId}-${expenseId}`;
      await AsyncStorage.setItem(key, JSON.stringify(isPaid));
    },

    getPaidStatusFromStorage: async (budgetId, expenseId) => {
      const key = `paidStatus-${budgetId}-${expenseId}`;
      const status = await AsyncStorage.getItem(key);
      return status ? JSON.parse(status) : false;
    },

    toggleExpensePaid: (budgetId, expenseId) => {
      const { budgets, setBudgets, getPaidStatusFromStorage, setPaidStatusInStorage } = get();
    
      const updatedBudgets = budgets.map((budget) => {
        if (budget.id === budgetId) {
          const updatedBills = budget.bills.map(bill => {
            if (bill.expense.id === expenseId) {
              const newPaidStatus = !bill.paid;
              setPaidStatusInStorage(budgetId, expenseId, newPaidStatus);
              return { ...bill, paid: newPaidStatus };
            }
            return bill;
          });
    
          return { ...budget, bills: updatedBills };
        }
        return budget;
      });
    
      setBudgets(updatedBudgets);
    },
    
    moveExpenseBetweenBudgets: (fromBudgetId, toBudgetId, expenseId) => {
      const { budgets, setBudgets } = get();

      const expenseToMove = budgets
        .find(budget => budget.id === fromBudgetId)?.bills
        .find(bill => bill.expense.id === expenseId);

      if (expenseToMove) {
        const updatedBudgets = budgets.map(budget => {
          if (budget.id === fromBudgetId) {
            return { ...budget, bills: budget.bills.filter(bill => bill.expense.id !== expenseId) };
          }
          if (budget.id === toBudgetId) {
            return { ...budget, bills: [...budget.bills, expenseToMove] };
          }
          return budget;
        });

        setBudgets(updatedBudgets);
      }
    },
    
    recalculateBudgets: async () => {
      const { incomes, expenses, setBudgets, getPaidStatusFromStorage } = get();
    
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // Next 3 months
    
      const generateOccurrences = <T extends { date: string | Date; frequency?: FrequencyInterface }>(
        items: T[]
      ): T[] => {
        return items.flatMap((item) => {
          const occurrences: T[] = [];
          let occurrenceDate = new Date(item.date);
    
          while (occurrenceDate <= endDate) {
            occurrences.push({
              ...item,
              id: uuid.v4().toString(),
              date: new Date(occurrenceDate),
            });
    
            if (!item.frequency) break;
    
            switch (item.frequency.unit) {
              case "days":
                occurrenceDate.setDate(occurrenceDate.getDate() + item.frequency.value);
                break;
              case "weeks":
                occurrenceDate.setDate(occurrenceDate.getDate() + item.frequency.value * 7);
                break;
              case "months":
                occurrenceDate.setMonth(occurrenceDate.getMonth() + item.frequency.value);
                break;
              case "semi-monthly":
                occurrenceDate.setDate(occurrenceDate.getDate() <= 15 ? 15 : 1);
                if (occurrenceDate.getDate() === 1) occurrenceDate.setMonth(occurrenceDate.getMonth() + 1);
                break;
              default:
                console.warn(`Unknown frequency unit:`, item.frequency.unit);
                break;
            }
          }
          return occurrences;
        });
      };
    
      const allIncomes = generateOccurrences(incomes).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    
      const allExpenses = generateOccurrences(expenses).sort((a, b) => b.amount - a.amount); // Sort expenses by most expensive first
    
      const paidStatusCache: Record<string, boolean> = {};
    
      const getCachedPaidStatus = async (incomeId: string, expenseId: string) => {
        const key = `${incomeId}-${expenseId}`;
        if (!(key in paidStatusCache)) {
          paidStatusCache[key] = await getPaidStatusFromStorage(incomeId, expenseId);
        }
        return paidStatusCache[key];
      };
    
      const assignExpensesToBudget = async (
        expenses: ExpenseInterface[],
        budget: StoredBudget,
        allBudgets: StoredBudget[]
      ): Promise<Bill[]> => {
        const bills: Bill[] = [];
      
        for (const expense of expenses) {
          if (budget.remainingBalance >= expense.amount) {
            const paid = await getCachedPaidStatus(budget.income.id, expense.id);
            budget.remainingBalance -= expense.amount;
            bills.push({ expense, paid });
          } else {
            const previousBudget = findPreviousBudgetWithBalance(expense.amount, allBudgets, budget);
            if (previousBudget) {
              previousBudget.remainingBalance -= expense.amount;
              previousBudget.bills.push({ expense, paid: false });
            } else {
              console.warn(`No budget found with enough balance for expense ${expense.name}`);
            }
          }
        }
      
        return bills.sort((a, b) => new Date(a.expense.date).getTime() - new Date(b.expense.date).getTime());
      };      
    
      const findPreviousBudgetWithBalance = (
        amount: number,
        allBudgets: StoredBudget[],
        currentBudget: StoredBudget
      ): StoredBudget | null => {
        const currentIndex = allBudgets.indexOf(currentBudget);
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (allBudgets[i].remainingBalance >= amount) {
            return allBudgets[i];
          }
        }
        return null;
      };
    
      const budgets: StoredBudget[] = await Promise.all(
        allIncomes.map(async (income, index): Promise<StoredBudget> => {
          const nextIncomeDate = allIncomes[index + 1]?.date;
    
          const associatedExpenses = allExpenses.filter((expense) => {
            const expenseDate = new Date(expense.date);
            return (
              expenseDate >= new Date(income.date) &&
              (!nextIncomeDate || expenseDate < new Date(nextIncomeDate))
            );
          });
    
          const budget: StoredBudget = {
            id: uuid.v4().toString(),
            date: income.date.toISOString(),
            income: {
              ...income,
              amount: manualUpdates.incomes.get(income.id) ?? income.amount,
            },
            bills: [],
            remainingBalance: income.amount,
          };
    
          budget.bills = await assignExpensesToBudget(associatedExpenses, budget, budgets);
    
          return budget;
        })
      );
    
      setBudgets(budgets);
    },        
    
    addOrUpdateIncome: (
      incomeForm: Partial<IncomeInterface>,
      frequency: FrequencyInterface | undefined,
      isEditing: boolean
    ) => {
      const { incomes, setIncomes, recalculateBudgets } = get();

      if (isEditing && incomeForm.id) {
        const updatedIncomes = incomes.map((income) =>
          income.id === incomeForm.id
            ? {
              ...income,
              ...incomeForm,
              frequency,
            }
            : income
        );
        setIncomes(updatedIncomes);
      } else {
        if (!incomeForm.name || !incomeForm.date || !incomeForm.amount) {
          throw new Error("Missing required fields for new income");
        }

        const newIncome: IncomeInterface = {
          id: uuid.v4().toString(),
          name: incomeForm.name,
          date: incomeForm.date,
          amount: incomeForm.amount,
          frequency: frequency ?? undefined,
        };

        setIncomes([...incomes, newIncome]);
      }

      recalculateBudgets();
    },

    addOrUpdateExpense: (
      expenseForm: Partial<ExpenseInterface>,
      frequency: FrequencyInterface | undefined,
      isEditing: boolean
    ) => {
      const { expenses, setExpenses, recalculateBudgets } = get();

      if (isEditing && expenseForm.id) {
        const updatedExpenses = expenses.map((expense) =>
          expense.id === expenseForm.id
            ? {
              ...expense,
              ...expenseForm,
              frequency,
            }
            : expense
        );
        setExpenses(updatedExpenses);
      } else {
        if (!expenseForm.name || !expenseForm.date || !expenseForm.amount) {
          throw new Error("Missing required fields for new expense");
        }

        const newExpense: ExpenseInterface = {
          id: uuid.v4().toString(),
          name: expenseForm.name,
          date: expenseForm.date,
          amount: expenseForm.amount,
          frequency: frequency ?? undefined,
        };

        setExpenses([...expenses, newExpense]);
      }

      recalculateBudgets();
    },
  };
});

export default useBudgetStore;
