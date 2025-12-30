import { prisma } from "../db";
import { getExpensesByCategory } from "./expenses";

export async function setBudget(
  userId: string,
  category: string,
  limit: number,
  month?: number,
  year?: number
) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  return prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId,
        category,
        month: targetMonth,
        year: targetYear,
      },
    },
    update: { limit },
    create: {
      userId,
      category,
      limit,
      month: targetMonth,
      year: targetYear,
    },
  });
}

export async function getBudgets(userId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  return prisma.budget.findMany({
    where: {
      userId,
      month: targetMonth,
      year: targetYear,
    },
  });
}

export async function getBudgetStatus(userId: string, month?: number, year?: number) {
  const budgets = await getBudgets(userId, month, year);
  const expenses = await getExpensesByCategory(userId, month, year);

  const expenseMap = new Map(expenses.map((e) => [e.category, e.total]));

  return budgets.map((budget) => {
    const spent = expenseMap.get(budget.category) ?? 0;
    const remaining = budget.limit - spent;
    const percentUsed = (spent / budget.limit) * 100;

    return {
      category: budget.category,
      limit: budget.limit,
      spent,
      remaining,
      percentUsed,
      isOverBudget: spent > budget.limit,
    };
  });
}

export async function deleteBudget(id: string, userId: string) {
  return prisma.budget.delete({
    where: { id, userId },
  });
}
