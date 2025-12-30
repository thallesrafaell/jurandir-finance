import type { FunctionDeclaration } from "@google/genai";

// Tools disponíveis em todos os contextos (privado e grupo)
export const tools: FunctionDeclaration[] = [
  {
    name: "add_expense",
    description: "Registra uma nova despesa. Em grupos, use member_name para registrar para outro membro.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da despesa (ex: almoço, uber, mercado)",
        },
        amount: {
          type: "number",
          description: "Valor da despesa em reais",
        },
        category: {
          type: "string",
          enum: ["alimentação", "transporte", "moradia", "saúde", "lazer", "educação", "vestuário", "cartões", "empréstimo", "outros"],
          description: "Categoria da despesa",
        },
        paid: {
          type: "boolean",
          description: "Se a despesa já foi paga (opcional, default: false)",
        },
        member_name: {
          type: "string",
          description: "Nome do membro do grupo para quem registrar (opcional, só em grupos)",
        },
      },
      required: ["description", "amount", "category"],
    },
  },
  {
    name: "list_expenses",
    description: "Lista as despesas do usuário",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filtrar por categoria (opcional)",
        },
        limit: {
          type: "number",
          description: "Quantidade máxima de resultados",
        },
      },
    },
  },
  {
    name: "get_expenses_summary",
    description: "Mostra o resumo de despesas por categoria do mês atual",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_investment",
    description: "Registra um novo investimento",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nome do investimento (ex: Bitcoin, PETR4, Tesouro Selic)",
        },
        type: {
          type: "string",
          enum: ["stocks", "crypto", "fixed_income", "funds", "other"],
          description: "Tipo do investimento",
        },
        amount: {
          type: "number",
          description: "Valor investido em reais",
        },
      },
      required: ["name", "type", "amount"],
    },
  },
  {
    name: "get_investment_summary",
    description: "Mostra o resumo dos investimentos do usuário",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "set_budget",
    description: "Define um limite de orçamento mensal para uma categoria",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Categoria do orçamento",
        },
        limit: {
          type: "number",
          description: "Limite de gastos em reais",
        },
      },
      required: ["category", "limit"],
    },
  },
  {
    name: "get_budget_status",
    description: "Mostra o status do orçamento - quanto gastou vs limite",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_income",
    description: "Registra uma nova entrada/receita. Em grupos, use member_name para registrar para outro membro.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da entrada (ex: salário dezembro, freelance site)",
        },
        amount: {
          type: "number",
          description: "Valor recebido em reais",
        },
        source: {
          type: "string",
          enum: ["salário", "freelance", "investimentos", "presente", "outros"],
          description: "Fonte da receita",
        },
        member_name: {
          type: "string",
          description: "Nome do membro do grupo para quem registrar (opcional, só em grupos)",
        },
      },
      required: ["description", "amount", "source"],
    },
  },
  {
    name: "list_incomes",
    description: "Lista as entradas/receitas do usuário",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description: "Filtrar por fonte (opcional)",
        },
        limit: {
          type: "number",
          description: "Quantidade máxima de resultados",
        },
      },
    },
  },
  {
    name: "get_income_summary",
    description: "Mostra o resumo de entradas/receitas por fonte do mês atual",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_balance",
    description: "Mostra o saldo do mês (entradas - despesas)",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_full_report",
    description: "Gera relatório completo formatado com entradas, despesas e saldo do mês",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "mark_expense_paid",
    description: "Marca uma despesa como paga",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da despesa a marcar como paga",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "mark_expense_unpaid",
    description: "Marca uma despesa como não paga (pendente)",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da despesa a marcar como pendente",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "delete_expense",
    description: "Remove/exclui uma despesa pelo nome",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da despesa a remover",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "clear_all_expenses",
    description: "Remove/apaga TODAS as despesas de uma vez",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "edit_expense",
    description: "Edita/altera uma despesa existente",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da despesa a editar (para encontrá-la)",
        },
        new_description: {
          type: "string",
          description: "Nova descrição (opcional)",
        },
        new_amount: {
          type: "number",
          description: "Novo valor (opcional)",
        },
        new_category: {
          type: "string",
          enum: ["alimentação", "transporte", "moradia", "saúde", "lazer", "educação", "vestuário", "cartões", "empréstimo", "outros"],
          description: "Nova categoria (opcional)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "delete_income",
    description: "Remove/exclui uma entrada pelo nome",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da entrada a remover",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "clear_all_incomes",
    description: "Remove/apaga TODAS as entradas de uma vez",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "clear_all",
    description: "Remove/apaga TODAS as despesas E entradas de uma vez (limpa tudo)",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "edit_income",
    description: "Edita/altera uma entrada existente",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Descrição da entrada a editar (para encontrá-la)",
        },
        new_description: {
          type: "string",
          description: "Nova descrição (opcional)",
        },
        new_amount: {
          type: "number",
          description: "Novo valor (opcional)",
        },
        new_source: {
          type: "string",
          enum: ["salário", "freelance", "investimentos", "presente", "outros"],
          description: "Nova fonte (opcional)",
        },
      },
      required: ["description"],
    },
  },
];

// Tools disponíveis apenas em grupos
export const groupTools: FunctionDeclaration[] = [
  {
    name: "get_group_report",
    description: "Gera relatório completo do grupo com todas as despesas e entradas dos membros",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_group_split",
    description: "Calcula a divisão de despesas do grupo - mostra quem deve quanto para quem",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_group_members",
    description: "Lista todos os membros registrados no grupo",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];
