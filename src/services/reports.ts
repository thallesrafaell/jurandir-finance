import { prisma } from "../db";
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

export async function getFullReport(userId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  // Busca despesas do mês
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { category: "asc" },
  });

  // Busca entradas do mês
  const incomes = await prisma.income.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { source: "asc" },
  });

  // Agrupa despesas por categoria
  const expensesByCategory: Record<string, typeof expenses> = {};
  for (const expense of expenses) {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = [];
    }
    expensesByCategory[expense.category].push(expense);
  }

  // Agrupa entradas por fonte
  const incomesBySource: Record<string, typeof incomes> = {};
  for (const income of incomes) {
    if (!incomesBySource[income.source]) {
      incomesBySource[income.source] = [];
    }
    incomesBySource[income.source].push(income);
  }

  // Monta o relatório
  let report = "✅ *Resumo Financeiro*\n\n";

  // Seção de Entradas
  if (incomes.length > 0) {
    report += "📥 *ENTRADAS*\n\n";

    for (const [source, items] of Object.entries(incomesBySource)) {
      const emoji = SOURCE_EMOJIS[source] || "📦";
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

      report += `${emoji} *${source.charAt(0).toUpperCase() + source.slice(1)}*\n`;
      for (const item of items) {
        report += `    • ${item.description}: ${formatCurrency(item.amount)}\n`;
      }
      report += `\n_Subtotal: R$ ${formatCurrency(subtotal)}_\n\n`;
    }

    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
    report += `💰 *Total Entradas: R$ ${formatCurrency(totalIncome)}*\n\n`;
    report += "⸻\n\n";
  }

  // Seção de Despesas
  if (expenses.length > 0) {
    report += "📤 *DESPESAS*\n\n";

    for (const [category, items] of Object.entries(expensesByCategory)) {
      const emoji = CATEGORY_EMOJIS[category] || "📦";
      const subtotal = items.reduce((sum, e) => sum + e.amount, 0);

      report += `${emoji} *${category.charAt(0).toUpperCase() + category.slice(1)}*\n`;
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
    if (totalPaid > 0) {
      report += `✅ Pago: R$ ${formatCurrency(totalPaid)}\n`;
    }
    if (totalPending > 0) {
      report += `⏳ Pendente: R$ ${formatCurrency(totalPending)}\n`;
    }
    report += "\n⸻\n\n";
  }

  // Saldo
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴";

  report += `🔢 *SALDO DO MÊS*\n\n`;
  report += `${balanceEmoji} *R$ ${formatCurrency(balance)}*`;

  if (expenses.length === 0 && incomes.length === 0) {
    report = "Nenhuma movimentação encontrada no período.";
  }

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

/**
 * Gera relatório completo do grupo
 */
export async function getGroupReport(groupId: string, month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

  // Busca grupo
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });

  if (!group) {
    return "Grupo não encontrado.";
  }

  // Busca despesas do grupo
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      date: { gte: startDate, lte: endDate },
    },
    include: { user: true },
    orderBy: { category: "asc" },
  });

  // Busca entradas do grupo
  const incomes = await prisma.income.findMany({
    where: {
      groupId,
      date: { gte: startDate, lte: endDate },
    },
    include: { user: true },
    orderBy: { source: "asc" },
  });

  // Monta o relatório
  const groupName = group.name || "Grupo";
  let report = `👥 *Relatório do ${groupName}*\n\n`;

  // Seção de Entradas
  if (incomes.length > 0) {
    report += "📥 *ENTRADAS*\n\n";

    const incomesBySource: Record<string, typeof incomes> = {};
    for (const income of incomes) {
      if (!incomesBySource[income.source]) {
        incomesBySource[income.source] = [];
      }
      incomesBySource[income.source].push(income);
    }

    for (const [source, items] of Object.entries(incomesBySource)) {
      const emoji = SOURCE_EMOJIS[source] || "📦";
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);

      report += `${emoji} *${source.charAt(0).toUpperCase() + source.slice(1)}*\n`;
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

  // Seção de Despesas
  if (expenses.length > 0) {
    report += "📤 *DESPESAS*\n\n";

    const expensesByCategory: Record<string, typeof expenses> = {};
    for (const expense of expenses) {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = [];
      }
      expensesByCategory[expense.category].push(expense);
    }

    for (const [category, items] of Object.entries(expensesByCategory)) {
      const emoji = CATEGORY_EMOJIS[category] || "📦";
      const subtotal = items.reduce((sum, e) => sum + e.amount, 0);

      report += `${emoji} *${category.charAt(0).toUpperCase() + category.slice(1)}*\n`;
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
    if (totalPaid > 0) {
      report += `✅ Pago: R$ ${formatCurrency(totalPaid)}\n`;
    }
    if (totalPending > 0) {
      report += `⏳ Pendente: R$ ${formatCurrency(totalPending)}\n`;
    }
    report += "\n⸻\n\n";
  }

  // Saldo
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;
  const balanceEmoji = balance >= 0 ? "🟢" : "🔴";

  report += `🔢 *SALDO DO GRUPO*\n\n`;
  report += `${balanceEmoji} *R$ ${formatCurrency(balance)}*`;

  if (expenses.length === 0 && incomes.length === 0) {
    report = `👥 *${groupName}*\n\nNenhuma movimentação encontrada no período.`;
  }

  return report;
}

/**
 * Gera relatório de divisão de despesas do grupo
 */
export async function getGroupSplitReport(groupId: string, month?: number, year?: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    return "Grupo não encontrado.";
  }

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
