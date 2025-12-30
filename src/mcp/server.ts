import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { prisma } from "../db";
import * as expensesService from "../services/expenses";
import * as investmentsService from "../services/investments";
import * as budgetService from "../services/budget";

const server = new McpServer({
  name: "jurandir-finance",
  version: "1.0.0",
});

// Tool: Adicionar despesa
server.tool(
  "add_expense",
  "Adiciona uma nova despesa",
  {
    userId: z.string().describe("ID do usuário"),
    description: z.string().describe("Descrição da despesa"),
    amount: z.number().describe("Valor da despesa"),
    category: z.string().describe("Categoria (alimentação, transporte, lazer, etc)"),
  },
  async ({ userId, description, amount, category }) => {
    const expense = await expensesService.addExpense(userId, description, amount, category);
    return {
      content: [
        {
          type: "text" as const,
          text: `Despesa adicionada: ${description} - R$ ${amount.toFixed(2)} (${category})`,
        },
      ],
    };
  }
);

// Tool: Listar despesas
server.tool(
  "list_expenses",
  "Lista as despesas do usuário",
  {
    userId: z.string().describe("ID do usuário"),
    category: z.string().optional().describe("Filtrar por categoria"),
    limit: z.number().optional().describe("Limitar quantidade de resultados"),
  },
  async ({ userId, category, limit }) => {
    const expenses = await expensesService.getExpenses(userId, { category, limit });
    const text = expenses
      .map((e) => `- ${e.description}: R$ ${e.amount.toFixed(2)} (${e.category}) - ${e.date.toLocaleDateString("pt-BR")}`)
      .join("\n");
    return {
      content: [{ type: "text" as const, text: text || "Nenhuma despesa encontrada" }],
    };
  }
);

// Tool: Resumo por categoria
server.tool(
  "expenses_by_category",
  "Mostra o total de despesas por categoria no mês",
  {
    userId: z.string().describe("ID do usuário"),
    month: z.number().optional().describe("Mês (1-12)"),
    year: z.number().optional().describe("Ano"),
  },
  async ({ userId, month, year }) => {
    const summary = await expensesService.getExpensesByCategory(userId, month, year);
    const text = summary.map((s) => `- ${s.category}: R$ ${s.total.toFixed(2)}`).join("\n");
    return {
      content: [{ type: "text" as const, text: text || "Nenhuma despesa no período" }],
    };
  }
);

// Tool: Adicionar investimento
server.tool(
  "add_investment",
  "Adiciona um novo investimento",
  {
    userId: z.string().describe("ID do usuário"),
    name: z.string().describe("Nome do investimento"),
    type: z.enum(["stocks", "crypto", "fixed_income", "funds", "other"]).describe("Tipo"),
    amount: z.number().describe("Valor investido"),
  },
  async ({ userId, name, type, amount }) => {
    await investmentsService.addInvestment(userId, name, type, amount);
    return {
      content: [
        { type: "text" as const, text: `Investimento adicionado: ${name} - R$ ${amount.toFixed(2)} (${type})` },
      ],
    };
  }
);

// Tool: Resumo de investimentos
server.tool(
  "investment_summary",
  "Mostra o resumo dos investimentos do usuário",
  {
    userId: z.string().describe("ID do usuário"),
  },
  async ({ userId }) => {
    const summary = await investmentsService.getInvestmentSummary(userId);
    const text = `
Total Investido: R$ ${summary.totalInvested.toFixed(2)}
Valor Atual: R$ ${summary.totalCurrentValue.toFixed(2)}
Retorno: R$ ${summary.totalReturn.toFixed(2)} (${summary.returnPercentage.toFixed(2)}%)

Por tipo:
${Object.entries(summary.byType)
  .map(([type, data]) => `- ${type}: R$ ${data.currentValue.toFixed(2)}`)
  .join("\n")}
    `.trim();
    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

// Tool: Status do orçamento
server.tool(
  "budget_status",
  "Mostra o status do orçamento por categoria",
  {
    userId: z.string().describe("ID do usuário"),
    month: z.number().optional().describe("Mês (1-12)"),
    year: z.number().optional().describe("Ano"),
  },
  async ({ userId, month, year }) => {
    const status = await budgetService.getBudgetStatus(userId, month, year);
    if (status.length === 0) {
      return { content: [{ type: "text" as const, text: "Nenhum orçamento definido" }] };
    }
    const text = status
      .map(
        (s) =>
          `- ${s.category}: R$ ${s.spent.toFixed(2)} / R$ ${s.limit.toFixed(2)} (${s.percentUsed.toFixed(0)}%)${s.isOverBudget ? " EXCEDIDO!" : ""}`
      )
      .join("\n");
    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

// Tool: Definir orçamento
server.tool(
  "set_budget",
  "Define um limite de orçamento para uma categoria",
  {
    userId: z.string().describe("ID do usuário"),
    category: z.string().describe("Categoria"),
    limit: z.number().describe("Limite de gastos"),
  },
  async ({ userId, category, limit }) => {
    await budgetService.setBudget(userId, category, limit);
    return {
      content: [
        { type: "text" as const, text: `Orçamento definido: ${category} - R$ ${limit.toFixed(2)}/mês` },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jurandir Finance MCP Server running on stdio");
}

main().catch(console.error);
