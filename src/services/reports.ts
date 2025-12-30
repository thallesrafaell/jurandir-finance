import { prisma } from "../db";
import { getMonthRange } from "../utils/date";
import { calculateSplit } from "./groups";

const CATEGORY_EMOJIS: Record<string, string> = {
  moradia: "🏠",
  alimentação: "🍽️",
  transporte: "🚗",
  saúde: "💊",
  lazer: "🎉",
  educação: "📚",
  vestuário: "👕",
  cartões: "💳",
  empréstimo: "💸",
  outros: "📦",
};

const SOURCE_EMOJIS: Record<string, string> = {
  salário: "💰",
  freelance: "💻",
  investimentos: "📈",
  presente: "🎁",
  outros: "📦",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupByKey<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}

export async function getFullReport(userId: string, month?: number, year?: number) {
  const { startDate, endDate } = getMonthRange(month, year);

  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { category: "asc" },
  });

  const incomes = await prisma.income.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { source: "asc" },
  });

  if (expenses.length === 0 && incomes.length === 0) {
    return "Nenhuma movimentação encontrada no período.";
  }

  const expensesByCategory = groupByKey(expenses, (e) => e.category);
  const incomesBySource = groupByKey(incomes, (i) => i.source);

  let report = "✅ *Resumo Financeiro*\n\n";

  if (incomes.length > 0) {
    report += "📥 *ENTRADAS*\n\n";

    for (const [source, items] of Object.entries(incomesBySource)) {
      const emoji = SOURCE_EMOJIS[source] || "📦";
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

      report += `${emoji} *${capitalize(source)}*\n`;
      for (const item of items) {
        report += `    • ${item.description}: ${formatCurrency(item.amount)}\n`;
      }
      report += `\n_Subtotal: R$ ${formatCurrency(subtotal)}_\n\n`;
    }

    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    report += `💰 *Total Entradas: R$ ${formatCurrency(totalIncome)}*\n\n`;
    report += "⸻\n\n";
  }

  if (expenses.length > 0) {
    report += "📤 *DESPESAS*\n\n";

    for (const [category, items] of Object.entries(expensesByCategory)) {
      const emoji = CATEGORY_EMOJIS[category] || "📦";
      const subtotal = items.reduce((sum, e) => sum + e.amount, 0);

      report += `${emoji} *${capitalize(category)}*\n`;
      for (const item of items) {
        const paidMark = item.paid ? " ✅" : "";
        report += `    • ${item.description}: ${formatCurrency(item.amount)}${paidMark}\n`;
      }
      report += `\n_Subtotal: R$ ${formatCurrency(subtotal)}_\n\n`;
    }

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = expenses.filter((e) => e.paid).reduce((sum, e) => sum + e.amount, 0);
    const totalPending = totalExpense - totalPaid;

    report += `💸 *Total Despesas: R$ ${formatCurrency(totalExpense)}*\n`;
    if (totalPaid > 0) report += `✅ Pago: R$ ${formatCurrency(totalPaid)}\n`;
    if (totalPending > 0) report += `⏳ Pendente: R$ ${formatCurrency(totalPending)}\n`;
    report += "\n⸻\n\n";
  }

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴";

  report += `🔢 *SALDO DO MÊS*\n\n`;
  report += `${balanceEmoji} *R$ ${formatCurrency(balance)}*`;

  return report;
}

export async function markExpenseAsPaid(expenseId: string, userId: string) {
  return prisma.expense.update({
    where: { id: expenseId, userId },
    data: { paid: true },
  });
}

export async function markExpenseAsUnpaid(expenseId: string, userId: string) {
  return prisma.expense.update({
    where: { id: expenseId, userId },
    data: { paid: false },
  });
}

export async function getGroupReport(groupId: string, month?: number, year?: number) {
  const { startDate, endDate } = getMonthRange(month, year);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });

  if (!group) return "Grupo não encontrado.";

  const expenses = await prisma.expense.findMany({
    where: { groupId, date: { gte: startDate, lte: endDate } },
    include: { user: true },
    orderBy: { category: "asc" },
  });

  const incomes = await prisma.income.findMany({
    where: { groupId, date: { gte: startDate, lte: endDate } },
    include: { user: true },
    orderBy: { source: "asc" },
  });

  const groupName = group.name || "Grupo";

  if (expenses.length === 0 && incomes.length === 0) {
    return `👥 *${groupName}*\n\nNenhuma movimentação encontrada no período.`;
  }

  let report = `👥 *Relatório do ${groupName}*\n\n`;

  if (incomes.length > 0) {
    report += "📥 *ENTRADAS*\n\n";

    const incomesBySource = groupByKey(incomes, (i) => i.source);

    for (const [source, items] of Object.entries(incomesBySource)) {
      const emoji = SOURCE_EMOJIS[source] || "📦";
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

      report += `${emoji} *${capitalize(source)}*\n`;
      for (const item of items) {
        const userName = item.user.name || item.user.phone.slice(-4);
        report += `    • ${item.description}: ${formatCurrency(item.amount)} (${userName})\n`;
      }
      report += `\n_Subtotal: R$ ${formatCurrency(subtotal)}_\n\n`;
    }

    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    report += `💰 *Total Entradas: R$ ${formatCurrency(totalIncome)}*\n\n`;
    report += "⸻\n\n";
  }

  if (expenses.length > 0) {
    report += "📤 *DESPESAS*\n\n";

    const expensesByCategory = groupByKey(expenses, (e) => e.category);

    for (const [category, items] of Object.entries(expensesByCategory)) {
      const emoji = CATEGORY_EMOJIS[category] || "📦";
      const subtotal = items.reduce((sum, e) => sum + e.amount, 0);

      report += `${emoji} *${capitalize(category)}*\n`;
      for (const item of items) {
        const userName = item.user.name || item.user.phone.slice(-4);
        const paidMark = item.paid ? " ✅" : "";
        report += `    • ${item.description}: ${formatCurrency(item.amount)} (${userName})${paidMark}\n`;
      }
      report += `\n_Subtotal: R$ ${formatCurrency(subtotal)}_\n\n`;
    }

    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = expenses.filter((e) => e.paid).reduce((sum, e) => sum + e.amount, 0);
    const totalPending = totalExpense - totalPaid;

    report += `💸 *Total Despesas: R$ ${formatCurrency(totalExpense)}*\n`;
    if (totalPaid > 0) report += `✅ Pago: R$ ${formatCurrency(totalPaid)}\n`;
    if (totalPending > 0) report += `⏳ Pendente: R$ ${formatCurrency(totalPending)}\n`;
    report += "\n⸻\n\n";
  }

  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴";

  report += `🔢 *SALDO DO GRUPO*\n\n`;
  report += `${balanceEmoji} *R$ ${formatCurrency(balance)}*`;

  return report;
}

export async function getGroupSplitReport(groupId: string, month?: number, year?: number) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });

  if (!group) return "Grupo não encontrado.";

  const split = await calculateSplit(groupId, month, year);
  const groupName = group.name || "Grupo";

  if (split.total === 0) {
    return `👥 *${groupName}*\n\nNenhuma despesa encontrada no período.`;
  }

  let report = `💰 *Divisão de Despesas - ${groupName}*\n\n`;
  report += `📊 *Total gasto:* R$ ${formatCurrency(split.total)}\n`;
  report += `👤 *Por pessoa:* R$ ${formatCurrency(split.perPerson)}\n\n`;

  report += "⸻\n\n";
  report += "📋 *Quanto cada um gastou:*\n\n";

  for (const balance of split.balances) {
    const emoji = balance.balance >= 0 ? "🟢" : "🔴";
    const status = balance.balance >= 0 ? "a receber" : "a pagar";
    report += `${emoji} *${balance.name}*\n`;
    report += `    Gastou: R$ ${formatCurrency(balance.spent)}\n`;
    report += `    ${status}: R$ ${formatCurrency(Math.abs(balance.balance))}\n\n`;
  }

  if (split.debts.length > 0) {
    report += "⸻\n\n";
    report += "💸 *Quem deve para quem:*\n\n";

    for (const debt of split.debts) {
      report += `• *${debt.fromName}* deve pagar *R$ ${formatCurrency(debt.amount)}* para *${debt.toName}*\n`;
    }
  }

  return report;
}
