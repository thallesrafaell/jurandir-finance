import { prisma } from "../db";
import { getMonthRange } from "../utils/date";

export async function upsertGroup(groupId: string, name?: string) {
  return prisma.group.upsert({
    where: { id: groupId },
    update: { name },
    create: { id: groupId, name },
  });
}

export async function getGroup(groupId: string) {
  return prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });
}

export async function addMember(groupId: string, userId: string, role: "admin" | "member" = "member") {
  await prisma.group.upsert({
    where: { id: groupId },
    update: {},
    create: { id: groupId },
  });

  return prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { role },
    create: { groupId, userId, role },
  });
}

export async function removeMember(groupId: string, userId: string) {
  return prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return !!member;
}

export async function getMembers(groupId: string) {
  return prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });
}

export async function getUserGroups(userId: string) {
  return prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
  });
}

export async function validateGroupAccess(groupId: string, userId: string): Promise<boolean> {
  return isMember(groupId, userId);
}

export async function ensureMember(groupId: string, userId: string, groupName?: string) {
  await prisma.group.upsert({
    where: { id: groupId },
    update: groupName ? { name: groupName } : {},
    create: { id: groupId, name: groupName },
  });

  return prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId, role: "member" },
  });
}

export async function findMemberByName(groupId: string, memberName: string): Promise<string | null> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const searchName = memberName.toLowerCase().trim();

  const exactMatch = members.find((m) => m.user.name?.toLowerCase() === searchName);
  if (exactMatch) return exactMatch.userId;

  const partialMatch = members.find((m) => m.user.name?.toLowerCase().includes(searchName));
  if (partialMatch) return partialMatch.userId;

  return null;
}

export async function createVirtualMember(groupId: string, memberName: string): Promise<string> {
  const fakePhone = `virtual_${memberName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

  const user = await prisma.user.create({
    data: { phone: fakePhone, name: memberName },
  });

  await prisma.groupMember.create({
    data: { groupId, userId: user.id, role: "member" },
  });

  return user.id;
}

export async function findOrCreateMemberByName(groupId: string, memberName: string): Promise<string> {
  const existingUserId = await findMemberByName(groupId, memberName);
  if (existingUserId) return existingUserId;

  return createVirtualMember(groupId, memberName);
}

export async function calculateSplit(groupId: string, month?: number, year?: number) {
  const { startDate, endDate } = getMonthRange(month, year);

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      date: { gte: startDate, lte: endDate },
    },
    include: { user: true },
  });

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  if (members.length === 0) {
    return { total: 0, perPerson: 0, balances: [], debts: [] };
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const perPerson = total / members.length;

  const spentByUser: Record<string, { spent: number; name: string }> = {};

  for (const member of members) {
    spentByUser[member.userId] = {
      spent: 0,
      name: member.user.name || member.user.phone,
    };
  }

  for (const expense of expenses) {
    if (spentByUser[expense.userId]) {
      spentByUser[expense.userId].spent += expense.amount;
    }
  }

  const balances = Object.entries(spentByUser).map(([userId, data]) => ({
    userId,
    name: data.name,
    spent: data.spent,
    balance: data.spent - perPerson,
  }));

  const debts: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];

  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, balance: Math.abs(b.balance) }));
  const creditors = balances.filter((b) => b.balance > 0);

  for (const debtor of debtors) {
    let remaining = debtor.balance;

    for (const creditor of creditors) {
      if (remaining <= 0.01) break;
      if (creditor.balance <= 0.01) continue;

      const amount = Math.min(remaining, creditor.balance);

      if (amount > 0.01) {
        debts.push({
          from: debtor.userId,
          fromName: debtor.name,
          to: creditor.userId,
          toName: creditor.name,
          amount: Math.round(amount * 100) / 100,
        });

        remaining -= amount;
        creditor.balance -= amount;
      }
    }
  }

  return {
    total: Math.round(total * 100) / 100,
    perPerson: Math.round(perPerson * 100) / 100,
    balances,
    debts,
  };
}
