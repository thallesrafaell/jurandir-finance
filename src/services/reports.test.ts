import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

const mockCalculateSplit = mock(() =>
  Promise.resolve({
    total: 0,
    perPerson: 0,
    balances: [],
    debts: [],
  })
);

mock.module("./groups", () => ({
  calculateSplit: mockCalculateSplit,
}));

import {
  getFullReport,
  markExpenseAsPaid,
  markExpenseAsUnpaid,
  getGroupReport,
  getGroupSplitReport,
} from "./reports";

describe("Reports Service", () => {
  beforeEach(() => {
    resetAllMocks();
    mockCalculateSplit.mockClear();
  });

  describe("getFullReport", () => {
    test("should return no movements message when empty", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getFullReport("user-1");

      expect(result).toBe("Nenhuma movimentação encontrada no período.");
    });

    test("should generate report with incomes only", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);
      mockPrisma.income.findMany.mockResolvedValueOnce([
        { id: "1", description: "Salário", amount: 5000, source: "salário" },
      ]);

      const result = await getFullReport("user-1");

      expect(result).toContain("*Resumo Financeiro*");
      expect(result).toContain("*ENTRADAS*");
      expect(result).toContain("Salário");
      expect(result).toContain("5.000,00");
    });

    test("should generate report with expenses only", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        {
          id: "1",
          description: "Almoço",
          amount: 50,
          category: "alimentação",
          paid: true,
        },
        {
          id: "2",
          description: "Uber",
          amount: 25,
          category: "transporte",
          paid: false,
        },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getFullReport("user-1");

      expect(result).toContain("*DESPESAS*");
      expect(result).toContain("Almoço");
      expect(result).toContain("Uber");
      expect(result).toContain("✅");
    });

    test("should generate full report with balance", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        { id: "1", description: "Almoço", amount: 1000, category: "alimentação", paid: false },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([
        { id: "1", description: "Salário", amount: 5000, source: "salário" },
      ]);

      const result = await getFullReport("user-1");

      expect(result).toContain("*SALDO DO MÊS*");
      expect(result).toContain("🟢");
      expect(result).toContain("4.000,00");
    });

    test("should show negative balance with red indicator", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        { id: "1", description: "Almoço", amount: 3000, category: "alimentação", paid: false },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([
        { id: "1", description: "Salário", amount: 2000, source: "salário" },
      ]);

      const result = await getFullReport("user-1");

      expect(result).toContain("🔴");
    });

    test("should group by category with subtotals", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        { id: "1", description: "Almoço", amount: 50, category: "alimentação", paid: false },
        { id: "2", description: "Jantar", amount: 80, category: "alimentação", paid: false },
        { id: "3", description: "Uber", amount: 30, category: "transporte", paid: false },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getFullReport("user-1");

      expect(result).toContain("*Alimentação*");
      expect(result).toContain("*Transporte*");
      expect(result).toContain("Subtotal");
    });

    test("should show paid and pending totals", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        { id: "1", description: "Almoço", amount: 100, category: "alimentação", paid: true },
        { id: "2", description: "Jantar", amount: 50, category: "alimentação", paid: false },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getFullReport("user-1");

      expect(result).toContain("Pago:");
      expect(result).toContain("Pendente:");
    });
  });

  describe("markExpenseAsPaid", () => {
    test("should mark expense as paid", async () => {
      mockPrisma.expense.update.mockResolvedValueOnce({ id: "1", paid: true });

      const result = await markExpenseAsPaid("exp-1", "user-1");

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: "exp-1", userId: "user-1" },
        data: { paid: true },
      });
      expect(result.paid).toBe(true);
    });
  });

  describe("markExpenseAsUnpaid", () => {
    test("should mark expense as unpaid", async () => {
      mockPrisma.expense.update.mockResolvedValueOnce({ id: "1", paid: false });

      const result = await markExpenseAsUnpaid("exp-1", "user-1");

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: "exp-1", userId: "user-1" },
        data: { paid: false },
      });
      expect(result.paid).toBe(false);
    });
  });

  describe("getGroupReport", () => {
    test("should return not found for invalid group", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce(null);

      const result = await getGroupReport("invalid-group");

      expect(result).toBe("Grupo não encontrado.");
    });

    test("should return no movements for empty group", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: "Familia",
        members: [],
      });
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getGroupReport("group-1");

      expect(result).toContain("Familia");
      expect(result).toContain("Nenhuma movimentação encontrada");
    });

    test("should generate group report with user names", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: "Familia",
        members: [{ user: { id: "user-1", name: "João" } }],
      });
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        {
          id: "1",
          description: "Pizza",
          amount: 100,
          category: "alimentação",
          paid: false,
          user: { name: "João", phone: "111" },
        },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getGroupReport("group-1");

      expect(result).toContain("Relatório do Familia");
      expect(result).toContain("Pizza");
      expect(result).toContain("João");
    });

    test("should use phone suffix when name not available", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: null,
        members: [],
      });
      mockPrisma.expense.findMany.mockResolvedValueOnce([
        {
          id: "1",
          description: "Pizza",
          amount: 100,
          category: "alimentação",
          paid: false,
          user: { name: null, phone: "5511999999999" },
        },
      ]);
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      const result = await getGroupReport("group-1");

      expect(result).toContain("9999");
    });
  });

  describe("getGroupSplitReport", () => {
    test("should return not found for invalid group", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce(null);

      const result = await getGroupSplitReport("invalid-group");

      expect(result).toBe("Grupo não encontrado.");
    });

    test("should return no expenses message when total is 0", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: "Familia",
      });
      mockCalculateSplit.mockResolvedValueOnce({
        total: 0,
        perPerson: 0,
        balances: [],
        debts: [],
      });

      const result = await getGroupSplitReport("group-1");

      expect(result).toContain("Familia");
      expect(result).toContain("Nenhuma despesa encontrada");
    });

    test("should generate split report with balances", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: "Familia",
      });
      mockCalculateSplit.mockResolvedValueOnce({
        total: 300,
        perPerson: 100,
        balances: [
          { userId: "user-1", name: "João", spent: 300, balance: 200 },
          { userId: "user-2", name: "Maria", spent: 0, balance: -100 },
          { userId: "user-3", name: "Pedro", spent: 0, balance: -100 },
        ],
        debts: [
          { from: "user-2", fromName: "Maria", to: "user-1", toName: "João", amount: 100 },
          { from: "user-3", fromName: "Pedro", to: "user-1", toName: "João", amount: 100 },
        ],
      });

      const result = await getGroupSplitReport("group-1");

      expect(result).toContain("Divisão de Despesas");
      expect(result).toContain("Total gasto");
      expect(result).toContain("300,00");
      expect(result).toContain("Por pessoa");
      expect(result).toContain("100,00");
      expect(result).toContain("Quanto cada um gastou");
      expect(result).toContain("João");
      expect(result).toContain("Maria");
      expect(result).toContain("Quem deve para quem");
    });

    test("should show who receives and who pays", async () => {
      mockPrisma.group.findUnique.mockResolvedValueOnce({
        id: "group-1",
        name: "Amigos",
      });
      mockCalculateSplit.mockResolvedValueOnce({
        total: 200,
        perPerson: 100,
        balances: [
          { userId: "user-1", name: "João", spent: 200, balance: 100 },
          { userId: "user-2", name: "Maria", spent: 0, balance: -100 },
        ],
        debts: [
          { from: "user-2", fromName: "Maria", to: "user-1", toName: "João", amount: 100 },
        ],
      });

      const result = await getGroupSplitReport("group-1");

      expect(result).toContain("a receber");
      expect(result).toContain("a pagar");
      expect(result).toContain("Maria");
      expect(result).toContain("deve pagar");
      expect(result).toContain("João");
    });
  });
});
