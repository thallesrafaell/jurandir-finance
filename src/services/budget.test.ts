import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

mock.module("./expenses", () => ({
  getExpensesByCategory: mock(() => Promise.resolve([])),
}));

import { setBudget, getBudgets, getBudgetStatus, deleteBudget } from "./budget";
import { getExpensesByCategory } from "./expenses";

describe("Budget Service", () => {
  beforeEach(() => {
    resetAllMocks();
    (getExpensesByCategory as ReturnType<typeof mock>).mockClear();
  });

  describe("setBudget", () => {
    test("should create or update budget for category", async () => {
      const mockBudget = {
        id: "budget-1",
        userId: "user-1",
        category: "alimentação",
        limit: 1000,
        month: 1,
        year: 2025,
      };

      mockPrisma.budget.upsert.mockResolvedValueOnce(mockBudget);

      const result = await setBudget("user-1", "alimentação", 1000, 1, 2025);

      expect(mockPrisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          userId_category_month_year: {
            userId: "user-1",
            category: "alimentação",
            month: 1,
            year: 2025,
          },
        },
        update: { limit: 1000 },
        create: {
          userId: "user-1",
          category: "alimentação",
          limit: 1000,
          month: 1,
          year: 2025,
        },
      });
      expect(result).toEqual(mockBudget);
    });

    test("should use current month/year as default", async () => {
      mockPrisma.budget.upsert.mockResolvedValueOnce({});

      const now = new Date();
      await setBudget("user-1", "transporte", 500);

      expect(mockPrisma.budget.upsert).toHaveBeenCalledWith({
        where: {
          userId_category_month_year: {
            userId: "user-1",
            category: "transporte",
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          },
        },
        update: { limit: 500 },
        create: expect.objectContaining({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        }),
      });
    });
  });

  describe("getBudgets", () => {
    test("should get all budgets for month", async () => {
      const mockBudgets = [
        { id: "1", category: "alimentação", limit: 1000 },
        { id: "2", category: "transporte", limit: 500 },
      ];

      mockPrisma.budget.findMany.mockResolvedValueOnce(mockBudgets);

      const result = await getBudgets("user-1", 1, 2025);

      expect(mockPrisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          month: 1,
          year: 2025,
        },
      });
      expect(result).toEqual(mockBudgets);
    });

    test("should use current month as default", async () => {
      mockPrisma.budget.findMany.mockResolvedValueOnce([]);

      const now = new Date();
      await getBudgets("user-1");

      expect(mockPrisma.budget.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        },
      });
    });
  });

  describe("getBudgetStatus", () => {
    test("should calculate budget status under budget", async () => {
      mockPrisma.budget.findMany.mockResolvedValueOnce([
        { id: "1", category: "alimentação", limit: 1000, month: 1, year: 2025 },
      ]);

      (getExpensesByCategory as ReturnType<typeof mock>).mockResolvedValueOnce([
        { category: "alimentação", total: 600 },
      ]);

      const result = await getBudgetStatus("user-1", 1, 2025);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        category: "alimentação",
        limit: 1000,
        spent: 600,
        remaining: 400,
        percentUsed: 60,
        isOverBudget: false,
      });
    });

    test("should calculate budget status over budget", async () => {
      mockPrisma.budget.findMany.mockResolvedValueOnce([
        { id: "1", category: "lazer", limit: 500, month: 1, year: 2025 },
      ]);

      (getExpensesByCategory as ReturnType<typeof mock>).mockResolvedValueOnce([
        { category: "lazer", total: 750 },
      ]);

      const result = await getBudgetStatus("user-1", 1, 2025);

      expect(result[0]).toEqual({
        category: "lazer",
        limit: 500,
        spent: 750,
        remaining: -250,
        percentUsed: 150,
        isOverBudget: true,
      });
    });

    test("should handle zero expenses", async () => {
      mockPrisma.budget.findMany.mockResolvedValueOnce([
        { id: "1", category: "saúde", limit: 300, month: 1, year: 2025 },
      ]);

      (getExpensesByCategory as ReturnType<typeof mock>).mockResolvedValueOnce([]);

      const result = await getBudgetStatus("user-1", 1, 2025);

      expect(result[0]).toEqual({
        category: "saúde",
        limit: 300,
        spent: 0,
        remaining: 300,
        percentUsed: 0,
        isOverBudget: false,
      });
    });

    test("should handle multiple budgets", async () => {
      mockPrisma.budget.findMany.mockResolvedValueOnce([
        { id: "1", category: "alimentação", limit: 1000, month: 1, year: 2025 },
        { id: "2", category: "transporte", limit: 500, month: 1, year: 2025 },
        { id: "3", category: "lazer", limit: 300, month: 1, year: 2025 },
      ]);

      (getExpensesByCategory as ReturnType<typeof mock>).mockResolvedValueOnce([
        { category: "alimentação", total: 800 },
        { category: "transporte", total: 500 },
      ]);

      const result = await getBudgetStatus("user-1", 1, 2025);

      expect(result).toHaveLength(3);
      expect(result[0].isOverBudget).toBe(false);
      expect(result[1].isOverBudget).toBe(false);
      expect(result[1].percentUsed).toBe(100);
      expect(result[2].spent).toBe(0);
    });
  });

  describe("deleteBudget", () => {
    test("should delete budget by id", async () => {
      const deleted = { id: "budget-1", category: "alimentação" };
      mockPrisma.budget.delete.mockResolvedValueOnce(deleted);

      const result = await deleteBudget("budget-1", "user-1");

      expect(mockPrisma.budget.delete).toHaveBeenCalledWith({
        where: { id: "budget-1", userId: "user-1" },
      });
      expect(result).toEqual(deleted);
    });
  });
});
