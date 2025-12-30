import * as expensesService from "../services/expenses";
import * as investmentsService from "../services/investments";
import * as budgetService from "../services/budget";
import * as incomeService from "../services/income";
import * as reportsService from "../services/reports";
import * as groupsService from "../services/groups";
import { toolLogger } from "../utils/logger";
import type { MessageContext } from "../types";

type ToolArgs = Record<string, unknown>;

async function resolveMemberTarget(
  context: MessageContext,
  args: ToolArgs
): Promise<{ targetUserId: string; memberName?: string }> {
  const { userId, groupId, isGroup } = context;

  if (!isGroup || !groupId || !args.member_name) {
    return { targetUserId: userId };
  }

  const targetUserId = await groupsService.findOrCreateMemberByName(groupId, args.member_name as string);
  const members = await groupsService.getMembers(groupId);
  const member = members.find((m) => m.userId === targetUserId);
  const memberName = member?.user.name || (args.member_name as string);

  return { targetUserId, memberName };
}

async function handleAddExpense(args: ToolArgs, context: MessageContext): Promise<string> {
  const { targetUserId, memberName } = await resolveMemberTarget(context, args);
  const { groupId, isGroup } = context;

  const expense = await expensesService.addExpense(
    targetUserId,
    args.description as string,
    args.amount as number,
    args.category as string,
    undefined,
    args.paid as boolean | undefined,
    isGroup ? groupId : undefined
  );

  const paidStatus = expense.paid ? " ✅" : "";
  const forMember = memberName ? ` (${memberName})` : "";
  return `Despesa registrada: ${expense.description} - R$ ${expense.amount.toFixed(2)} (${expense.category})${paidStatus}${forMember}`;
}

async function handleListExpenses(args: ToolArgs, context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;

  if (isGroup && groupId) {
    const expenses = await expensesService.getGroupExpenses(groupId, {
      category: args.category as string | undefined,
      limit: (args.limit as number) || 10,
    });
    if (expenses.length === 0) return "Nenhuma despesa encontrada no grupo.";
    return expenses
      .map((e) => {
        const userName = e.user.name || e.user.phone.slice(-4);
        return `• ${e.description}: R$ ${e.amount.toFixed(2)} (${e.category}) - ${userName}`;
      })
      .join("\n");
  }

  const expenses = await expensesService.getExpenses(userId, {
    category: args.category as string | undefined,
    limit: (args.limit as number) || 10,
  });
  if (expenses.length === 0) return "Nenhuma despesa encontrada.";
  return expenses.map((e) => `• ${e.description}: R$ ${e.amount.toFixed(2)} (${e.category})`).join("\n");
}

async function handleGetExpensesSummary(context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;

  if (isGroup && groupId) {
    const summary = await expensesService.getGroupExpensesByCategory(groupId);
    if (summary.length === 0) return "Nenhuma despesa do grupo este mês.";
    const total = summary.reduce((sum, s) => sum + s.total, 0);
    return (
      summary.map((s) => `• ${s.category}: R$ ${s.total.toFixed(2)}`).join("\n") +
      `\n\nTotal do grupo: R$ ${total.toFixed(2)}`
    );
  }

  const summary = await expensesService.getExpensesByCategory(userId);
  if (summary.length === 0) return "Nenhuma despesa este mês.";
  const total = summary.reduce((sum, s) => sum + s.total, 0);
  return summary.map((s) => `• ${s.category}: R$ ${s.total.toFixed(2)}`).join("\n") + `\n\nTotal: R$ ${total.toFixed(2)}`;
}

async function handleAddIncome(args: ToolArgs, context: MessageContext): Promise<string> {
  const { targetUserId, memberName } = await resolveMemberTarget(context, args);
  const { groupId, isGroup } = context;

  const income = await incomeService.addIncome(
    targetUserId,
    args.description as string,
    args.amount as number,
    args.source as string,
    undefined,
    isGroup ? groupId : undefined
  );

  const forMember = memberName ? ` (${memberName})` : "";
  return `Entrada registrada: ${income.description} - R$ ${income.amount.toFixed(2)} (${income.source})${forMember}`;
}

async function handleListIncomes(args: ToolArgs, context: MessageContext): Promise<string> {
  const incomes = await incomeService.getIncomes(context.userId, {
    source: args.source as string | undefined,
    limit: (args.limit as number) || 10,
  });
  if (incomes.length === 0) return "Nenhuma entrada encontrada.";
  return incomes.map((i) => `• ${i.description}: R$ ${i.amount.toFixed(2)} (${i.source})`).join("\n");
}

async function handleGetIncomeSummary(context: MessageContext): Promise<string> {
  const summary = await incomeService.getIncomesBySource(context.userId);
  if (summary.length === 0) return "Nenhuma entrada este mês.";
  const total = summary.reduce((sum, s) => sum + s.total, 0);
  return summary.map((s) => `• ${s.source}: R$ ${s.total.toFixed(2)}`).join("\n") + `\n\nTotal: R$ ${total.toFixed(2)}`;
}

async function handleMarkExpense(args: ToolArgs, context: MessageContext, paid: boolean): Promise<string> {
  const { userId, groupId, isGroup } = context;
  const description = args.description as string;

  const expense = isGroup && groupId
    ? await expensesService.findGroupExpenseByDescription(groupId, description)
    : await expensesService.findExpenseByDescription(userId, description);

  if (!expense) {
    const scope = isGroup ? " no grupo" : "";
    return `Despesa "${description}" não encontrada${scope}.`;
  }

  if (paid) {
    await reportsService.markExpenseAsPaid(expense.id, expense.userId);
    return `✅ Despesa "${expense.description}" marcada como paga!`;
  } else {
    await reportsService.markExpenseAsUnpaid(expense.id, expense.userId);
    return `⏳ Despesa "${expense.description}" marcada como pendente.`;
  }
}

async function handleDeleteExpense(args: ToolArgs, context: MessageContext): Promise<string> {
  const deleted = await expensesService.deleteExpenseByDescription(
    context.userId,
    args.description as string,
    context.isGroup ? context.groupId : undefined
  );
  if (!deleted) return `Despesa "${args.description}" não encontrada.`;
  return `🗑️ Despesa "${deleted.description}" (R$ ${deleted.amount.toFixed(2)}) removida!`;
}

async function handleEditExpense(args: ToolArgs, context: MessageContext): Promise<string> {
  const updateData: { description?: string; amount?: number; category?: string } = {};
  if (args.new_description) updateData.description = args.new_description as string;
  if (args.new_amount) updateData.amount = args.new_amount as number;
  if (args.new_category) updateData.category = args.new_category as string;

  if (Object.keys(updateData).length === 0) return "Nenhuma alteração informada.";

  const updated = await expensesService.updateExpenseByDescription(
    context.userId,
    args.description as string,
    updateData,
    context.isGroup ? context.groupId : undefined
  );
  if (!updated) return `Despesa "${args.description}" não encontrada.`;
  return `✏️ Despesa atualizada: ${updated.description} - R$ ${updated.amount.toFixed(2)} (${updated.category})`;
}

async function handleDeleteIncome(args: ToolArgs, context: MessageContext): Promise<string> {
  const deleted = await incomeService.deleteIncomeByDescription(
    context.userId,
    args.description as string,
    context.isGroup ? context.groupId : undefined
  );
  if (!deleted) return `Entrada "${args.description}" não encontrada.`;
  return `🗑️ Entrada "${deleted.description}" (R$ ${deleted.amount.toFixed(2)}) removida!`;
}

async function handleEditIncome(args: ToolArgs, context: MessageContext): Promise<string> {
  const updateData: { description?: string; amount?: number; source?: string } = {};
  if (args.new_description) updateData.description = args.new_description as string;
  if (args.new_amount) updateData.amount = args.new_amount as number;
  if (args.new_source) updateData.source = args.new_source as string;

  if (Object.keys(updateData).length === 0) return "Nenhuma alteração informada.";

  const updated = await incomeService.updateIncomeByDescription(
    context.userId,
    args.description as string,
    updateData,
    context.isGroup ? context.groupId : undefined
  );
  if (!updated) return `Entrada "${args.description}" não encontrada.`;
  return `✏️ Entrada atualizada: ${updated.description} - R$ ${updated.amount.toFixed(2)} (${updated.source})`;
}

export async function executeTool(name: string, args: ToolArgs, context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;
  toolLogger.info({ tool: name, args, userId, groupId, isGroup }, `Executing tool: ${name}`);

  switch (name) {
    case "add_expense":
      return handleAddExpense(args, context);

    case "list_expenses":
      return handleListExpenses(args, context);

    case "get_expenses_summary":
      return handleGetExpensesSummary(context);

    case "add_investment": {
      const inv = await investmentsService.addInvestment(
        userId,
        args.name as string,
        args.type as "stocks" | "crypto" | "fixed_income" | "funds" | "other",
        args.amount as number
      );
      return `Investimento registrado: ${inv.name} - R$ ${inv.amount.toFixed(2)} (${inv.type})`;
    }

    case "get_investment_summary": {
      const summary = await investmentsService.getInvestmentSummary(userId);
      if (summary.totalInvested === 0) return "Nenhum investimento registrado.";
      return `Total Investido: R$ ${summary.totalInvested.toFixed(2)}
Valor Atual: R$ ${summary.totalCurrentValue.toFixed(2)}
Retorno: R$ ${summary.totalReturn.toFixed(2)} (${summary.returnPercentage.toFixed(2)}%)`;
    }

    case "set_budget": {
      await budgetService.setBudget(userId, args.category as string, args.limit as number);
      return `Orçamento definido: ${args.category} - R$ ${(args.limit as number).toFixed(2)}/mês`;
    }

    case "get_budget_status": {
      const status = await budgetService.getBudgetStatus(userId);
      if (status.length === 0) return "Nenhum orçamento definido.";
      return status
        .map(
          (s) =>
            `• ${s.category}: R$ ${s.spent.toFixed(2)} / R$ ${s.limit.toFixed(2)} (${s.percentUsed.toFixed(0)}%)${s.isOverBudget ? " ⚠️ EXCEDIDO" : ""}`
        )
        .join("\n");
    }

    case "add_income":
      return handleAddIncome(args, context);

    case "list_incomes":
      return handleListIncomes(args, context);

    case "get_income_summary":
      return handleGetIncomeSummary(context);

    case "get_balance": {
      const totalIncome = await incomeService.getTotalIncome(userId);
      const expensesSummary = await expensesService.getExpensesByCategory(userId);
      const totalExpenses = expensesSummary.reduce((sum, s) => sum + s.total, 0);
      const balance = totalIncome - totalExpenses;
      const status = balance >= 0 ? "positivo" : "negativo";
      return `Entradas: R$ ${totalIncome.toFixed(2)}
Despesas: R$ ${totalExpenses.toFixed(2)}
Saldo: R$ ${balance.toFixed(2)} (${status})`;
    }

    case "get_full_report":
      return isGroup && groupId ? reportsService.getGroupReport(groupId) : reportsService.getFullReport(userId);

    case "mark_expense_paid":
      return handleMarkExpense(args, context, true);

    case "mark_expense_unpaid":
      return handleMarkExpense(args, context, false);

    case "delete_expense":
      return handleDeleteExpense(args, context);

    case "clear_all_expenses": {
      const count = await expensesService.deleteAllExpenses(userId, isGroup ? groupId : undefined);
      if (count === 0) return "Nenhuma despesa para remover.";
      return `🗑️ ${count} despesa(s) removida(s)!`;
    }

    case "edit_expense":
      return handleEditExpense(args, context);

    case "delete_income":
      return handleDeleteIncome(args, context);

    case "clear_all_incomes": {
      const count = await incomeService.deleteAllIncomes(userId, isGroup ? groupId : undefined);
      if (count === 0) return "Nenhuma entrada para remover.";
      return `🗑️ ${count} entrada(s) removida(s)!`;
    }

    case "clear_all": {
      const expenseCount = await expensesService.deleteAllExpenses(userId, isGroup ? groupId : undefined);
      const incomeCount = await incomeService.deleteAllIncomes(userId, isGroup ? groupId : undefined);
      const total = expenseCount + incomeCount;
      if (total === 0) return "Nenhuma transação para remover.";
      return `🗑️ Tudo removido! ${expenseCount} despesa(s) e ${incomeCount} entrada(s) apagadas.`;
    }

    case "edit_income":
      return handleEditIncome(args, context);

    case "get_group_report":
      if (!isGroup || !groupId) return "Este comando só funciona em grupos.";
      return reportsService.getGroupReport(groupId);

    case "get_group_split":
      if (!isGroup || !groupId) return "Este comando só funciona em grupos.";
      return reportsService.getGroupSplitReport(groupId);

    case "list_group_members": {
      if (!isGroup || !groupId) return "Este comando só funciona em grupos.";
      const members = await groupsService.getMembers(groupId);
      if (members.length === 0) return "Nenhum membro registrado no grupo.";
      return members.map((m) => `• ${m.user.name || m.user.phone} (${m.role})`).join("\n");
    }

    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}
