import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

import {
  addExpense,
  getExpenses,
  getExpensesByCategory,
  deleteExpense,
  deleteExpenseByDescription,
  updateExpense,
  deleteAllExpenses,
  updateExpenseByDescription,
  findExpenseByDescription,
  getGroupExpenses,
  getGroupExpensesByCategory,
  findGroupExpenseByDescription,
} from "./expenses";

describe("Expenses Service", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("addExpense", () => {
    test("should create expense with all parameters", async () => {
      const mockExpense = {
        id: "exp-1",
        userId: "user-1",
        description: "Almoço",
        amount: 50.0,
        category: "alimentação",
        date: new Date("2025-01-15"),
        paid: true,
        groupId: null,
      };

      mockPrisma.expense.create.mockResolvedValueOnce(mockExpense);

      const result = await addExpense(
        "user-1",
        "Almoço",
        50.0,
        "alimentação",
        new Date("2025-01-15"),
        true
      );

      expect(mockPrisma.expense.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockExpense);
    });

    test("should create expense with default date and paid=false", async () => {
      const mockExpense = {
        id: "exp-2",
        userId: "user-1",
        description: "Uber",
        amount: 25.0,
        category: "transporte",
        date: expect.any(Date),
        paid: false,
        groupId: null,
      };

      mockPrisma.expense.create.mockResolvedValueOnce(mockExpense);

      await addExpense("user-1", "Uber", 25.0, "transporte");

      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          description: "Uber",
          amount: 25.0,
          category: "transporte",
          date: expect.any(Date),
          paid: false,
          groupId: undefined,
        },
      });
    });

    test("should create group expense", async () => {
      mockPrisma.expense.create.mockResolvedValueOnce({
        id: "exp-3",
        groupId: "group-1",
      });

      await addExpense(
        "user-1",
        "Pizza",
        100.0,
        "alimentação",
        undefined,
        false,
        "group-1"
      );

      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: "group-1",
        }),
      });
    });
  });

  describe("getExpenses", () => {
    test("should get all expenses for user", async () => {
      const mockExpenses = [
        { id: "1", description: "Expense 1", amount: 100 },
        { id: "2", description: "Expense 2", amount: 200 },
      ];

      mockPrisma.expense.findMany.mockResolvedValueOnce(mockExpenses);

      const result = await getExpenses("user-1");

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { date: "desc" },
        take: undefined,
      });
      expect(result).toEqual(mockExpenses);
    });

    test("should filter by category", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);

      await getExpenses("user-1", { category: "alimentação" });

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          category: "alimentação",
        },
        orderBy: { date: "desc" },
        take: undefined,
      });
    });

    test("should filter by date range", async () => {
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrisma.expense.findMany.mockResolvedValueOnce([]);

      await getExpenses("user-1", { startDate, endDate });

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: "desc" },
        take: undefined,
      });
    });

    test("should apply limit", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);

      await getExpenses("user-1", { limit: 10 });

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { date: "desc" },
        take: 10,
      });
    });
  });


  describe("deleteExpense", () => {
    test("should delete expense by id", async () => {
      const mockDeleted = { id: "exp-1", description: "Deleted" };
      mockPrisma.expense.delete.mockResolvedValueOnce(mockDeleted);

      const result = await deleteExpense("exp-1", "user-1");

      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
        where: { id: "exp-1", userId: "user-1" },
      });
      expect(result).toEqual(mockDeleted);
    });
  });

  describe("deleteExpenseByDescription", () => {
    test("should find and delete expense by description", async () => {
      const mockExpense = { id: "exp-1", description: "Almoço no restaurante" };
      mockPrisma.expense.findFirst.mockResolvedValueOnce(mockExpense);
      mockPrisma.expense.delete.mockResolvedValueOnce(mockExpense);

      const result = await deleteExpenseByDescription("user-1", "almoço");

      expect(mockPrisma.expense.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          groupId: null,
          description: { contains: "almoço", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
      expect(result).toEqual(mockExpense);
    });

    test("should return null if expense not found", async () => {
      mockPrisma.expense.findFirst.mockResolvedValueOnce(null);

      const result = await deleteExpenseByDescription("user-1", "inexistente");

      expect(result).toBeNull();
      expect(mockPrisma.expense.delete).not.toHaveBeenCalled();
    });

    test("should search in group context", async () => {
      mockPrisma.expense.findFirst.mockResolvedValueOnce({ id: "exp-1" });
      mockPrisma.expense.delete.mockResolvedValueOnce({});

      await deleteExpenseByDescription("user-1", "pizza", "group-1");

      expect(mockPrisma.expense.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          groupId: "group-1",
          description: { contains: "pizza", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
    });
  });

  describe("updateExpense", () => {
    test("should update expense fields", async () => {
      const updated = { id: "exp-1", amount: 150, paid: true };
      mockPrisma.expense.update.mockResolvedValueOnce(updated);

      const result = await updateExpense("exp-1", "user-1", {
        amount: 150,
        paid: true,
      });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: "exp-1", userId: "user-1" },
        data: { amount: 150, paid: true },
      });
      expect(result).toEqual(updated);
    });
  });

  describe("deleteAllExpenses", () => {
    test("should delete all personal expenses", async () => {
      mockPrisma.expense.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await deleteAllExpenses("user-1");

      expect(mockPrisma.expense.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", groupId: null },
      });
      expect(result).toBe(5);
    });

    test("should delete all group expenses", async () => {
      mockPrisma.expense.deleteMany.mockResolvedValueOnce({ count: 10 });

      const result = await deleteAllExpenses("user-1", "group-1");

      expect(mockPrisma.expense.deleteMany).toHaveBeenCalledWith({
        where: { groupId: "group-1" },
      });
      expect(result).toBe(10);
    });
  });

  describe("updateExpenseByDescription", () => {
    test("should find and update expense", async () => {
      const mockExpense = { id: "exp-1", description: "Uber" };
      const updated = { ...mockExpense, amount: 30 };

      mockPrisma.expense.findFirst.mockResolvedValueOnce(mockExpense);
      mockPrisma.expense.update.mockResolvedValueOnce(updated);

      const result = await updateExpenseByDescription("user-1", "uber", {
        amount: 30,
      });

      expect(result).toEqual(updated);
    });

    test("should return null if not found", async () => {
      mockPrisma.expense.findFirst.mockResolvedValueOnce(null);

      const result = await updateExpenseByDescription("user-1", "inexistente", {
        amount: 100,
      });

      expect(result).toBeNull();
    });
  });

  describe("findExpenseByDescription", () => {
    test("should find expense by partial description", async () => {
      const mockExpense = { id: "exp-1", description: "Almoço no trabalho" };
      mockPrisma.expense.findFirst.mockResolvedValueOnce(mockExpense);

      const result = await findExpenseByDescription("user-1", "almoço");

      expect(mockPrisma.expense.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          groupId: null,
          description: { contains: "almoço", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
      expect(result).toEqual(mockExpense);
    });
  });

  describe("getGroupExpenses", () => {
    test("should get group expenses with user info", async () => {
      const mockExpenses = [
        { id: "1", user: { name: "João" } },
        { id: "2", user: { name: "Maria" } },
      ];
      mockPrisma.expense.findMany.mockResolvedValueOnce(mockExpenses);

      const result = await getGroupExpenses("group-1");

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: { groupId: "group-1" },
        include: { user: true },
        orderBy: { date: "desc" },
        take: undefined,
      });
      expect(result).toEqual(mockExpenses);
    });

    test("should filter group expenses by category", async () => {
      mockPrisma.expense.findMany.mockResolvedValueOnce([]);

      await getGroupExpenses("group-1", { category: "lazer" });

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          groupId: "group-1",
          category: "lazer",
        },
        include: { user: true },
        orderBy: { date: "desc" },
        take: undefined,
      });
    });
  });


  describe("findGroupExpenseByDescription", () => {
    test("should find group expense by description", async () => {
      const mockExpense = { id: "exp-1", groupId: "group-1" };
      mockPrisma.expense.findFirst.mockResolvedValueOnce(mockExpense);

      const result = await findGroupExpenseByDescription("group-1", "pizza");

      expect(mockPrisma.expense.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: "group-1",
          description: { contains: "pizza", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
      expect(result).toEqual(mockExpense);
    });
  });
});
