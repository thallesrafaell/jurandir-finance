import { GoogleGenAI, Content } from "@google/genai";
import { config } from "../config";
import { SYSTEM_PROMPT, getGroupSystemPrompt } from "./prompts";
import { tools, groupTools } from "./tools";
import * as expensesService from "../services/expenses";
import * as investmentsService from "../services/investments";
import * as budgetService from "../services/budget";
import * as incomeService from "../services/income";
import * as reportsService from "../services/reports";
import * as groupsService from "../services/groups";
import { agentLogger, toolLogger } from "../utils/logger";
import type { MessageContext } from "../types";

const ai = new GoogleGenAI({});

// Histórico de conversas - chave é `userId` para privado ou `groupId` para grupos
const conversationHistory = new Map<string, Content[]>();
const MAX_HISTORY = 20;

function getHistoryKey(context: MessageContext): string {
  return context.isGroup && context.groupId ? context.groupId : context.userId;
}

function getHistory(context: MessageContext): Content[] {
  const key = getHistoryKey(context);
  if (!conversationHistory.has(key)) {
    conversationHistory.set(key, []);
  }
  return conversationHistory.get(key)!;
}

function addToHistory(context: MessageContext, role: "user" | "model", text: string) {
  const history = getHistory(context);
  history.push({ role, parts: [{ text }] });

  // Limita o histórico
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

type ToolArgs = Record<string, unknown>;

async function executeTool(name: string, args: ToolArgs, context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;
  toolLogger.info({ tool: name, args, userId, groupId, isGroup }, `Executing tool: ${name}`);

  switch (name) {
    // ==================== TOOLS PESSOAIS ====================
    case "add_expense": {
      // Em grupos, permite registrar para outro membro via member_name
      let targetUserId = userId;
      let memberName: string | undefined;

      if (isGroup && groupId && args.member_name) {
        targetUserId = await groupsService.findOrCreateMemberByName(groupId, args.member_name as string);
        // Busca o nome do membro para exibir
        const members = await groupsService.getMembers(groupId);
        const member = members.find(m => m.userId === targetUserId);
        memberName = member?.user.name || (args.member_name as string);
      }

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

    case "list_expenses": {
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
      return expenses
        .map((e) => `• ${e.description}: R$ ${e.amount.toFixed(2)} (${e.category})`)
        .join("\n");
    }

    case "get_expenses_summary": {
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
      return (
        summary.map((s) => `• ${s.category}: R$ ${s.total.toFixed(2)}`).join("\n") +
        `\n\nTotal: R$ ${total.toFixed(2)}`
      );
    }

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

    case "add_income": {
      // Em grupos, permite registrar para outro membro via member_name
      let targetUserId = userId;
      let memberName: string | undefined;

      if (isGroup && groupId && args.member_name) {
        targetUserId = await groupsService.findOrCreateMemberByName(groupId, args.member_name as string);
        // Busca o nome do membro para exibir
        const members = await groupsService.getMembers(groupId);
        const member = members.find(m => m.userId === targetUserId);
        memberName = member?.user.name || (args.member_name as string);
      }

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

    case "list_incomes": {
      const incomes = await incomeService.getIncomes(userId, {
        source: args.source as string | undefined,
        limit: (args.limit as number) || 10,
      });
      if (incomes.length === 0) return "Nenhuma entrada encontrada.";
      return incomes
        .map((i) => `• ${i.description}: R$ ${i.amount.toFixed(2)} (${i.source})`)
        .join("\n");
    }

    case "get_income_summary": {
      const summary = await incomeService.getIncomesBySource(userId);
      if (summary.length === 0) return "Nenhuma entrada este mês.";
      const total = summary.reduce((sum, s) => sum + s.total, 0);
      return (
        summary.map((s) => `• ${s.source}: R$ ${s.total.toFixed(2)}`).join("\n") +
        `\n\nTotal: R$ ${total.toFixed(2)}`
      );
    }

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

    case "get_full_report": {
      if (isGroup && groupId) {
        return await reportsService.getGroupReport(groupId);
      }
      return await reportsService.getFullReport(userId);
    }

    case "mark_expense_paid": {
      if (isGroup && groupId) {
        const expense = await expensesService.findGroupExpenseByDescription(
          groupId,
          args.description as string
        );
        if (!expense) {
          return `Despesa "${args.description}" não encontrada no grupo.`;
        }
        await reportsService.markExpenseAsPaid(expense.id, expense.userId);
        return `✅ Despesa "${expense.description}" marcada como paga!`;
      }

      const expense = await expensesService.findExpenseByDescription(
        userId,
        args.description as string
      );
      if (!expense) {
        return `Despesa "${args.description}" não encontrada.`;
      }
      await reportsService.markExpenseAsPaid(expense.id, userId);
      return `✅ Despesa "${expense.description}" marcada como paga!`;
    }

    case "mark_expense_unpaid": {
      if (isGroup && groupId) {
        const expense = await expensesService.findGroupExpenseByDescription(
          groupId,
          args.description as string
        );
        if (!expense) {
          return `Despesa "${args.description}" não encontrada no grupo.`;
        }
        await reportsService.markExpenseAsUnpaid(expense.id, expense.userId);
        return `⏳ Despesa "${expense.description}" marcada como pendente.`;
      }

      const expense = await expensesService.findExpenseByDescription(
        userId,
        args.description as string
      );
      if (!expense) {
        return `Despesa "${args.description}" não encontrada.`;
      }
      await reportsService.markExpenseAsUnpaid(expense.id, userId);
      return `⏳ Despesa "${expense.description}" marcada como pendente.`;
    }

    case "delete_expense": {
      const deleted = await expensesService.deleteExpenseByDescription(
        userId,
        args.description as string,
        isGroup ? groupId : undefined
      );
      if (!deleted) {
        return `Despesa "${args.description}" não encontrada.`;
      }
      return `🗑️ Despesa "${deleted.description}" (R$ ${deleted.amount.toFixed(2)}) removida!`;
    }

    case "clear_all_expenses": {
      const count = await expensesService.deleteAllExpenses(userId, isGroup ? groupId : undefined);
      if (count === 0) {
        return "Nenhuma despesa para remover.";
      }
      return `🗑️ ${count} despesa(s) removida(s)!`;
    }

    case "edit_expense": {
      const updateData: { description?: string; amount?: number; category?: string } = {};
      if (args.new_description) updateData.description = args.new_description as string;
      if (args.new_amount) updateData.amount = args.new_amount as number;
      if (args.new_category) updateData.category = args.new_category as string;

      if (Object.keys(updateData).length === 0) {
        return "Nenhuma alteração informada.";
      }

      const updated = await expensesService.updateExpenseByDescription(
        userId,
        args.description as string,
        updateData,
        isGroup ? groupId : undefined
      );
      if (!updated) {
        return `Despesa "${args.description}" não encontrada.`;
      }
      return `✏️ Despesa atualizada: ${updated.description} - R$ ${updated.amount.toFixed(2)} (${updated.category})`;
    }

    case "delete_income": {
      const deleted = await incomeService.deleteIncomeByDescription(
        userId,
        args.description as string,
        isGroup ? groupId : undefined
      );
      if (!deleted) {
        return `Entrada "${args.description}" não encontrada.`;
      }
      return `🗑️ Entrada "${deleted.description}" (R$ ${deleted.amount.toFixed(2)}) removida!`;
    }

    case "clear_all_incomes": {
      const count = await incomeService.deleteAllIncomes(userId, isGroup ? groupId : undefined);
      if (count === 0) {
        return "Nenhuma entrada para remover.";
      }
      return `🗑️ ${count} entrada(s) removida(s)!`;
    }

    case "clear_all": {
      const expenseCount = await expensesService.deleteAllExpenses(userId, isGroup ? groupId : undefined);
      const incomeCount = await incomeService.deleteAllIncomes(userId, isGroup ? groupId : undefined);
      const total = expenseCount + incomeCount;
      if (total === 0) {
        return "Nenhuma transação para remover.";
      }
      return `🗑️ Tudo removido! ${expenseCount} despesa(s) e ${incomeCount} entrada(s) apagadas.`;
    }

    case "edit_income": {
      const updateData: { description?: string; amount?: number; source?: string } = {};
      if (args.new_description) updateData.description = args.new_description as string;
      if (args.new_amount) updateData.amount = args.new_amount as number;
      if (args.new_source) updateData.source = args.new_source as string;

      if (Object.keys(updateData).length === 0) {
        return "Nenhuma alteração informada.";
      }

      const updated = await incomeService.updateIncomeByDescription(
        userId,
        args.description as string,
        updateData,
        isGroup ? groupId : undefined
      );
      if (!updated) {
        return `Entrada "${args.description}" não encontrada.`;
      }
      return `✏️ Entrada atualizada: ${updated.description} - R$ ${updated.amount.toFixed(2)} (${updated.source})`;
    }

    // ==================== TOOLS DE GRUPO ====================
    case "get_group_report": {
      if (!isGroup || !groupId) {
        return "Este comando só funciona em grupos.";
      }
      return await reportsService.getGroupReport(groupId);
    }

    case "get_group_split": {
      if (!isGroup || !groupId) {
        return "Este comando só funciona em grupos.";
      }
      return await reportsService.getGroupSplitReport(groupId);
    }

    case "list_group_members": {
      if (!isGroup || !groupId) {
        return "Este comando só funciona em grupos.";
      }
      const members = await groupsService.getMembers(groupId);
      if (members.length === 0) return "Nenhum membro registrado no grupo.";
      return members
        .map((m) => `• ${m.user.name || m.user.phone} (${m.role})`)
        .join("\n");
    }

    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}

export async function processMessage(userMessage: string, context: MessageContext): Promise<string> {
  const { userId, groupId, isGroup } = context;
  agentLogger.info({ userId, groupId, isGroup, message: userMessage }, "Processing message");

  try {
    // Adiciona mensagem do usuário ao histórico
    addToHistory(context, "user", userMessage);
    const history = getHistory(context);

    // Seleciona as tools e prompt corretos baseado no contexto
    const activeTools = isGroup ? [...tools, ...groupTools] : tools;
    const systemPrompt = isGroup ? getGroupSystemPrompt() : SYSTEM_PROMPT;

    agentLogger.debug({ model: config.gemini.model, historyLength: history.length, isGroup }, "Calling Gemini");

    let currentContents = [...history];
    let response = await ai.models.generateContent({
      model: config.gemini.model,
      contents: currentContents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: activeTools }],
      },
    });

    // Loop para processar múltiplas chamadas de função
    const MAX_ITERATIONS = 30; // Limite de segurança (suporta até 30 despesas/entradas por mensagem)
    let iterations = 0;
    let lastToolResults: string[] = []; // Guarda os últimos resultados das ferramentas

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Coleta todas as function calls desta resposta
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) {
        // Sem mais function calls, retorna o texto
        break;
      }

      agentLogger.info({ count: functionCalls.length, iteration: iterations }, "Processing function calls");

      // Executa todas as function calls em paralelo
      const functionCallParts: Array<{ functionCall: { name: string; args: unknown } }> = [];
      const functionResponseParts: Array<{ functionResponse: { name: string; response: { result: string } } }> = [];
      lastToolResults = []; // Limpa para esta iteração

      for (const part of functionCalls) {
        const { name, args } = part.functionCall!;
        agentLogger.info({ functionCall: name, args }, "Executing tool");

        const toolResult = await executeTool(name, args as ToolArgs, context);
        toolLogger.info({ tool: name, result: toolResult.slice(0, 100) }, "Tool executed");

        functionCallParts.push({ functionCall: { name, args } });
        functionResponseParts.push({
          functionResponse: { name, response: { result: toolResult } },
        });
        lastToolResults.push(toolResult);
      }

      // Adiciona as chamadas e respostas ao contexto
      currentContents = [
        ...currentContents,
        { role: "model" as const, parts: functionCallParts },
        { role: "user" as const, parts: functionResponseParts },
      ];

      // Chama o modelo novamente com os resultados
      response = await ai.models.generateContent({
        model: config.gemini.model,
        contents: currentContents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: activeTools }],
        },
      });
    }

    // SEMPRE usa os resultados das ferramentas diretamente (ignora reformatação do Gemini)
    let reply: string;

    if (lastToolResults.length > 0) {
      // Temos resultados de ferramentas - usa diretamente
      if (lastToolResults.length === 1) {
        // Uma única operação - usa o resultado direto
        reply = lastToolResults[0];
      } else {
        // Múltiplas operações - agrupa por tipo
        const registros = lastToolResults.filter(r => r.includes("registrad"));
        const exclusoes = lastToolResults.filter(r => r.includes("🗑️") || r.includes("removid"));
        const edicoes = lastToolResults.filter(r => r.includes("✏️") || r.includes("atualizad"));
        const marcacoes = lastToolResults.filter(r => r.includes("✅") || r.includes("⏳"));
        const erros = lastToolResults.filter(r => r.includes("não encontrad") || r.includes("Nenhum"));
        const outros = lastToolResults.filter(r =>
          !r.includes("registrad") &&
          !r.includes("🗑️") && !r.includes("removid") &&
          !r.includes("✏️") && !r.includes("atualizad") &&
          !r.includes("✅") && !r.includes("⏳") &&
          !r.includes("não encontrad") && !r.includes("Nenhum")
        );

        const partes: string[] = [];

        if (registros.length > 0) {
          if (registros.length <= 3) {
            partes.push(registros.join("\n"));
          } else {
            partes.push(`✅ ${registros.length} itens registrados com sucesso!`);
          }
        }

        if (exclusoes.length > 0) {
          if (exclusoes.length <= 3) {
            partes.push(exclusoes.join("\n"));
          } else {
            partes.push(`🗑️ ${exclusoes.length} itens removidos!`);
          }
        }

        if (edicoes.length > 0) {
          partes.push(edicoes.join("\n"));
        }

        if (marcacoes.length > 0) {
          partes.push(marcacoes.join("\n"));
        }

        if (erros.length > 0 && erros.length <= 3) {
          partes.push(erros.join("\n"));
        }

        if (outros.length > 0) {
          partes.push(outros.join("\n"));
        }

        reply = partes.join("\n\n") || lastToolResults.join("\n");
      }
    } else if (response.text && response.text.trim() !== "") {
      // Sem ferramentas executadas - usa resposta do Gemini (para conversas simples)
      reply = response.text;
    } else {
      reply = "Desculpe, não entendi. Pode reformular?";
    }

    addToHistory(context, "model", reply);

    agentLogger.info({ iterations }, "Finished processing message");
    return reply;
  } catch (error) {
    agentLogger.error({ error }, "Error processing message");
    throw error;
  }
}
