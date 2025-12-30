import { prisma } from "../db";

export type IncomeSource = "salário" | "freelance" | "investimentos" | "presente" | "outros";

export async function addIncome(
  userId: string,
  description: string,
  amount: number,
  source: string,
  date?: Date,
  groupId?: string
) {
  return prisma.income.create({
    data: {
      userId,
      description,
      amount,
      source,
      date: date ?? new Date(),
      groupId,
    },
  });
}

export async function getIncomes(
  userId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    source?: string;
    limit?: number;
  }
) {
  return prisma.income.findMany({
    where: {
      userId,
      ...(options?.source && { source: options.source }),
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

export async function getIncomesBySource(userId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  const incomes = await prisma.income.groupBy({
    by: ["source"],
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return incomes.map((i) => ({
    source: i.source,
    total: i._sum.amount ?? 0,
  }));
}

export async function getTotalIncome(userId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  const result = await prisma.income.aggregate({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount ?? 0;
}

export async function deleteIncome(id: string, userId: string) {
  return prisma.income.delete({
    where: { id, userId },
  });
}

export async function deleteAllIncomes(userId: string, groupId?: string) {
  const result = await prisma.income.deleteMany({
    where: groupId ? { groupId } : { userId, groupId: null },
  });
  return result.count;
}

export async function deleteIncomeByDescription(userId: string, description: string, groupId?: string) {
  const income = await prisma.income.findFirst({
    where: {
      userId: groupId ? undefined : userId,
      groupId: groupId ?? null,
      description: {
        contains: description,
        mode: "insensitive",
      },
    },
    orderBy: { date: "desc" },
  });

  if (!income) return null;

  await prisma.income.delete({ where: { id: income.id } });
  return income;
}

export async function updateIncome(
  id: string,
  userId: string,
  data: {
    description?: string;
    amount?: number;
    source?: string;
  }
) {
  return prisma.income.update({
    where: { id, userId },
    data,
  });
}

export async function updateIncomeByDescription(
  userId: string,
  description: string,
  data: {
    description?: string;
    amount?: number;
    source?: string;
  },
  groupId?: string
) {
  const income = await prisma.income.findFirst({
    where: {
      userId: groupId ? undefined : userId,
      groupId: groupId ?? null,
      description: {
        contains: description,
        mode: "insensitive",
      },
    },
    orderBy: { date: "desc" },
  });

  if (!income) return null;

  return prisma.income.update({
    where: { id: income.id },
    data,
  });
}
