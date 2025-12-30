import { prisma } from "../db";

export type InvestmentType = "stocks" | "crypto" | "fixed_income" | "funds" | "other";

export async function addInvestment(
  userId: string,
  name: string,
  type: InvestmentType,
  amount: number,
  currentValue?: number,
  purchaseDate?: Date
) {
  return prisma.investment.create({
    data: {
      userId,
      name,
      type,
      amount,
      currentValue: currentValue ?? amount,
      purchaseDate: purchaseDate ?? new Date(),
    },
  });
}

export async function getInvestments(userId: string, type?: InvestmentType) {
  return prisma.investment.findMany({
    where: {
      userId,
      ...(type && { type }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateInvestmentValue(id: string, userId: string, currentValue: number) {
  return prisma.investment.update({
    where: { id, userId },
    data: { currentValue },
  });
}

export async function getInvestmentSummary(userId: string) {
  const investments = await prisma.investment.findMany({
    where: { userId },
  });

  const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCurrentValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
  const totalReturn = totalCurrentValue - totalInvested;
  const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const byType = investments.reduce(
    (acc, inv) => {
      if (!acc[inv.type]) {
        acc[inv.type] = { invested: 0, currentValue: 0 };
      }
      acc[inv.type].invested += inv.amount;
      acc[inv.type].currentValue += inv.currentValue;
      return acc;
    },
    {} as Record<string, { invested: number; currentValue: number }>
  );

  return {
    totalInvested,
    totalCurrentValue,
    totalReturn,
    returnPercentage,
    byType,
  };
}

export async function deleteInvestment(id: string, userId: string) {
  return prisma.investment.delete({
    where: { id, userId },
  });
}
