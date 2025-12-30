import { prisma } from "../db";

/**
 * Cria ou atualiza um grupo
 */
export async function upsertGroup(groupId: string, name?: string) {
  return prisma.group.upsert({
    where: { id: groupId },
    update: { name },
    create: { id: groupId, name },
  });
}

/**
 * Busca um grupo pelo ID
 */
export async function getGroup(groupId: string) {
  return prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });
}

/**
 * Adiciona um usuário ao grupo
 */
export async function addMember(groupId: string, userId: string, role: "admin" | "member" = "member") {
  // Garante que o grupo existe
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

/**
 * Remove um usuário do grupo
 */
export async function removeMember(groupId: string, userId: string) {
  return prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });
}

/**
 * Verifica se um usuário é membro de um grupo
 */
export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return !!member;
}

/**
 * Lista todos os membros de um grupo
 */
export async function getMembers(groupId: string) {
  return prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });
}

/**
 * Lista todos os grupos de um usuário
 */
export async function getUserGroups(userId: string) {
  return prisma.groupMember.findMany({
    where: { userId },
    include: { group: true },
  });
}

/**
 * Valida se o usuário tem permissão para acessar dados do grupo
 * Retorna true se tem permissão, false caso contrário
 */
export async function validateGroupAccess(groupId: string, userId: string): Promise<boolean> {
  return isMember(groupId, userId);
}

/**
 * Garante que o usuário é membro do grupo, adicionando-o se necessário
 * Usado para auto-registro quando alguém envia mensagem no grupo
 */
export async function ensureMember(groupId: string, userId: string, groupName?: string) {
  // Upsert do grupo
  await prisma.group.upsert({
    where: { id: groupId },
    update: groupName ? { name: groupName } : {},
    create: { id: groupId, name: groupName },
  });

  // Upsert do membro
  return prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId, role: "member" },
  });
}

/**
 * Encontra um membro do grupo pelo nome (busca parcial, case-insensitive)
 * Retorna o userId do membro encontrado, ou null se não encontrar
 */
export async function findMemberByName(groupId: string, memberName: string): Promise<string | null> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const searchName = memberName.toLowerCase().trim();

  // Busca por nome exato primeiro
  const exactMatch = members.find(m =>
    m.user.name?.toLowerCase() === searchName
  );
  if (exactMatch) return exactMatch.userId;

  // Busca parcial (nome contém o termo)
  const partialMatch = members.find(m =>
    m.user.name?.toLowerCase().includes(searchName)
  );
  if (partialMatch) return partialMatch.userId;

  return null;
}

/**
 * Cria um usuário "virtual" para um membro do grupo que ainda não tem conta
 * Usado quando alguém registra transação para outro membro que nunca interagiu
 */
export async function createVirtualMember(groupId: string, memberName: string): Promise<string> {
  // Cria um usuário com um phone fictício baseado no nome
  const fakePhone = `virtual_${memberName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

  const user = await prisma.user.create({
    data: {
      phone: fakePhone,
      name: memberName,
    },
  });

  // Adiciona ao grupo
  await prisma.groupMember.create({
    data: {
      groupId,
      userId: user.id,
      role: "member",
    },
  });

  return user.id;
}

/**
 * Encontra ou cria um membro do grupo pelo nome
 * Se não encontrar, cria um usuário virtual
 */
export async function findOrCreateMemberByName(groupId: string, memberName: string): Promise<string> {
  const existingUserId = await findMemberByName(groupId, memberName);
  if (existingUserId) return existingUserId;

  return createVirtualMember(groupId, memberName);
}

/**
 * Calcula a divisão de despesas do grupo
 * Retorna quem deve quanto para quem
 */
export async function calculateSplit(groupId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  // Busca todas as despesas do grupo no período
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      date: { gte: startDate, lte: endDate },
    },
    include: { user: true },
  });

  // Busca membros do grupo
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  if (members.length === 0) {
    return { total: 0, perPerson: 0, balances: [], debts: [] };
  }

  // Total gasto
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const perPerson = total / members.length;

  // Quanto cada pessoa gastou
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

  // Calcula o saldo de cada pessoa (positivo = deve receber, negativo = deve pagar)
  const balances = Object.entries(spentByUser).map(([userId, data]) => ({
    userId,
    name: data.name,
    spent: data.spent,
    balance: data.spent - perPerson, // positivo = pagou mais, negativo = deve
  }));

  // Simplifica as dívidas (quem deve para quem)
  const debts: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];

  const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: Math.abs(b.balance) }));
  const creditors = balances.filter(b => b.balance > 0);

  // Algoritmo simples de matching de dívidas
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
