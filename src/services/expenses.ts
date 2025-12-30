import { prisma } from "../db";
import { getMonthRange } from "../utils/date";

export async function addExpense(
  userId: string,
  description: string,
  amount: number,
  category: string,
  date?: Date,
  paid?: boolean,
  groupId?: string
) {
  return prisma.expense.create({
    data: {
      userId,
      description,
      amount,
      category,
      date: date ?? new Date(),
      paid: paid ?? false,
      groupId,
    },
  });
}

export async function getExpenses(
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    limit?: number;
  }
) {
  return prisma.expense.findMany({
    where: {
      userId,
      ...(options?.category && { category: options.category }),
      ...(options?.startDate || options?.endDate
        ? {
            date: {
              ...(options?.startDate && { gte: options.startDate }),
              ...(options?.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: options?.limit,
  });
}

export async function getExpensesByCategory(userId: string, month?: number, year?: number) {
  const { startDate, endDate } = getMonthRange(month, year);

  const expenses = await prisma.expense.groupBy({
    by: ["category"],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  return expenses.map((e) => ({
    category: e.category,
    total: e._sum.amount ?? 0,
  }));
}

export async function deleteExpense(id: string, userId: string) {
  return prisma.expense.delete({
    where: { id, userId },
  });
}

export async function deleteExpenseByDescription(userId: string, description: string, groupId?: string) {
  const expense = await prisma.expense.findFirst({
    where: {
      userId: groupId ? undefined : userId,
      groupId: groupId ?? null,
      description: { contains: description, mode: "insensitive" },
    },
    orderBy: { date: "desc" },
  });

  if (!expense) return null;

  await prisma.expense.delete({ where: { id: expense.id } });
  return expense;
}

export async function updateExpense(
  id: string,
  userId: string,
  data: {
    description?: string;
    amount?: number;
    category?: string;
    paid?: boolean;
  }
) {
  return prisma.expense.update({
    where: { id, userId },
    data,
  });
}

export async function deleteAllExpenses(userId: string, groupId?: string) {
  const result = await prisma.expense.deleteMany({
    where: groupId ? { groupId } : { userId, groupId: null },
  });
  return result.count;
}

export async function updateExpenseByDescription(
  userId: string,
  description: string,
  data: {
    description?: string;
    amount?: number;
    category?: string;
    paid?: boolean;
  },
  groupId?: string
) {
  const expense = await prisma.expense.findFirst({
    where: {
      userId: groupId ? undefined : userId,
      groupId: groupId ?? null,
      description: { contains: description, mode: "insensitive" },
    },
    orderBy: { date: "desc" },
  });

  if (!expense) return null;

  return prisma.expense.update({
    where: { id: expense.id },
    data,
  });
}

export async function findExpenseByDescription(userId: string, description: string, groupId?: string) {
  return prisma.expense.findFirst({
    where: {
      userId,
      groupId: groupId ?? null,
      description: { contains: description, mode: "insensitive" },
    },
    orderBy: { date: "desc" },
  });
}

export async function getGroupExpenses(
  groupId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    limit?: number;
  }
) {
  return prisma.expense.findMany({
    where: {
      groupId,
      ...(options?.category && { category: options.category }),
      ...(options?.startDate || options?.endDate
        ? {
            date: {
              ...(options?.startDate && { gte: options.startDate }),
              ...(options?.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
    include: { user: true },
    orderBy: { date: "desc" },
    take: options?.limit,
  });
}

export async function getGroupExpensesByCategory(groupId: string, month?: number, year?: number) {
  const { startDate, endDate } = getMonthRange(month, year);

  const expenses = await prisma.expense.groupBy({
    by: ["category"],
    where: {
      groupId,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  return expenses.map((e) => ({
    category: e.category,
    total: e._sum.amount ?? 0,
  }));
}

export async function findGroupExpenseByDescription(groupId: string, description: string) {
  return prisma.expense.findFirst({
    where: {
      groupId,
      description: { contains: description, mode: "insensitive" },
    },
    orderBy: { date: "desc" },
  });
}
