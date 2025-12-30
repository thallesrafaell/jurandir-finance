export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  createdAt: Date;
}

export interface Investment {
  id: string;
  name: string;
  type: "stocks" | "crypto" | "fixed_income" | "funds" | "other";
  amount: number;
  currentValue: number;
  purchaseDate: Date;
  createdAt: Date;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  month: number;
  year: number;
}

export interface FinancialSummary {
  totalExpenses: number;
  totalInvestments: number;
  balance: number;
  expensesByCategory: Record<string, number>;
}
