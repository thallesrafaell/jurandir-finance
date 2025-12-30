import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

import {
  addIncome,
  getIncomes,
  getIncomesBySource,
  getTotalIncome,
  deleteIncome,
  deleteAllIncomes,
  deleteIncomeByDescription,
  updateIncome,
  updateIncomeByDescription,
} from "./income";

describe("Income Service", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("addIncome", () => {
    test("should create income with all parameters", async () => {
      const mockIncome = {
        id: "inc-1",
        userId: "user-1",
        description: "Salário",
        amount: 5000.0,
        source: "salário",
        date: new Date("2025-01-05"),
        groupId: null,
      };

      mockPrisma.income.create.mockResolvedValueOnce(mockIncome);

      const result = await addIncome(
        "user-1",
        "Salário",
        5000.0,
        "salário",
        new Date("2025-01-05")
      );

      expect(mockPrisma.income.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockIncome);
    });

    test("should create income with default date", async () => {
      mockPrisma.income.create.mockResolvedValueOnce({});

      await addIncome("user-1", "Freelance", 1000.0, "freelance");

      expect(mockPrisma.income.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          description: "Freelance",
          amount: 1000.0,
          source: "freelance",
          date: expect.any(Date),
          groupId: undefined,
        },
      });
    });

    test("should create group income", async () => {
      mockPrisma.income.create.mockResolvedValueOnce({ groupId: "group-1" });

      await addIncome(
        "user-1",
        "Vaquinha",
        500.0,
        "outros",
        undefined,
        "group-1"
      );

      expect(mockPrisma.income.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: "group-1",
        }),
      });
    });
  });

  describe("getIncomes", () => {
    test("should get all incomes for user", async () => {
      const mockIncomes = [
        { id: "1", description: "Salário", amount: 5000 },
        { id: "2", description: "Freelance", amount: 1000 },
      ];

      mockPrisma.income.findMany.mockResolvedValueOnce(mockIncomes);

      const result = await getIncomes("user-1");

      expect(mockPrisma.income.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { date: "desc" },
        take: undefined,
      });
      expect(result).toEqual(mockIncomes);
    });

    test("should filter by source", async () => {
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      await getIncomes("user-1", { source: "freelance" });

      expect(mockPrisma.income.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          source: "freelance",
        },
        orderBy: { date: "desc" },
        take: undefined,
      });
    });

    test("should filter by date range", async () => {
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");

      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      await getIncomes("user-1", { startDate, endDate });

      expect(mockPrisma.income.findMany).toHaveBeenCalledWith({
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
      mockPrisma.income.findMany.mockResolvedValueOnce([]);

      await getIncomes("user-1", { limit: 5 });

      expect(mockPrisma.income.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { date: "desc" },
        take: 5,
      });
    });
  });

  describe("getIncomesBySource", () => {
    test("should group incomes by source", async () => {
      mockPrisma.income.groupBy.mockResolvedValueOnce([
        { source: "salário", _sum: { amount: 5000 } },
        { source: "freelance", _sum: { amount: 2000 } },
      ]);

      const result = await getIncomesBySource("user-1", 1, 2025);

      expect(result).toEqual([
        { source: "salário", total: 5000 },
        { source: "freelance", total: 2000 },
      ]);
    });

    test("should handle null sum", async () => {
      mockPrisma.income.groupBy.mockResolvedValueOnce([
        { source: "outros", _sum: { amount: null } },
      ]);

      const result = await getIncomesBySource("user-1");

      expect(result).toEqual([{ source: "outros", total: 0 }]);
    });
  });

  describe("getTotalIncome", () => {
    test("should return total income for month", async () => {
      mockPrisma.income.aggregate.mockResolvedValueOnce({
        _sum: { amount: 7500 },
      });

      const result = await getTotalIncome("user-1", 1, 2025);

      expect(result).toBe(7500);
    });

    test("should return 0 when no income", async () => {
      mockPrisma.income.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });

      const result = await getTotalIncome("user-1");

      expect(result).toBe(0);
    });
  });

  describe("deleteIncome", () => {
    test("should delete income by id", async () => {
      const mockDeleted = { id: "inc-1", description: "Deleted" };
      mockPrisma.income.delete.mockResolvedValueOnce(mockDeleted);

      const result = await deleteIncome("inc-1", "user-1");

      expect(mockPrisma.income.delete).toHaveBeenCalledWith({
        where: { id: "inc-1", userId: "user-1" },
      });
      expect(result).toEqual(mockDeleted);
    });
  });

  describe("deleteAllIncomes", () => {
    test("should delete all personal incomes", async () => {
      mockPrisma.income.deleteMany.mockResolvedValueOnce({ count: 3 });

      const result = await deleteAllIncomes("user-1");

      expect(mockPrisma.income.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", groupId: null },
      });
      expect(result).toBe(3);
    });

    test("should delete all group incomes", async () => {
      mockPrisma.income.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await deleteAllIncomes("user-1", "group-1");

      expect(mockPrisma.income.deleteMany).toHaveBeenCalledWith({
        where: { groupId: "group-1" },
      });
      expect(result).toBe(5);
    });
  });

  describe("deleteIncomeByDescription", () => {
    test("should find and delete income by description", async () => {
      const mockIncome = { id: "inc-1", description: "Freelance projeto X" };
      mockPrisma.income.findFirst.mockResolvedValueOnce(mockIncome);
      mockPrisma.income.delete.mockResolvedValueOnce(mockIncome);

      const result = await deleteIncomeByDescription("user-1", "freelance");

      expect(mockPrisma.income.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          groupId: null,
          description: { contains: "freelance", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
      expect(result).toEqual(mockIncome);
    });

    test("should return null if income not found", async () => {
      mockPrisma.income.findFirst.mockResolvedValueOnce(null);

      const result = await deleteIncomeByDescription("user-1", "inexistente");

      expect(result).toBeNull();
      expect(mockPrisma.income.delete).not.toHaveBeenCalled();
    });

    test("should search in group context", async () => {
      mockPrisma.income.findFirst.mockResolvedValueOnce({ id: "inc-1" });
      mockPrisma.income.delete.mockResolvedValueOnce({});

      await deleteIncomeByDescription("user-1", "vaquinha", "group-1");

      expect(mockPrisma.income.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          groupId: "group-1",
          description: { contains: "vaquinha", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
    });
  });

  describe("updateIncome", () => {
    test("should update income fields", async () => {
      const updated = { id: "inc-1", amount: 5500, source: "salário" };
      mockPrisma.income.update.mockResolvedValueOnce(updated);

      const result = await updateIncome("inc-1", "user-1", {
        amount: 5500,
      });

      expect(mockPrisma.income.update).toHaveBeenCalledWith({
        where: { id: "inc-1", userId: "user-1" },
        data: { amount: 5500 },
      });
      expect(result).toEqual(updated);
    });
  });

  describe("updateIncomeByDescription", () => {
    test("should find and update income", async () => {
      const mockIncome = { id: "inc-1", description: "Salário" };
      const updated = { ...mockIncome, amount: 6000 };

      mockPrisma.income.findFirst.mockResolvedValueOnce(mockIncome);
      mockPrisma.income.update.mockResolvedValueOnce(updated);

      const result = await updateIncomeByDescription("user-1", "salário", {
        amount: 6000,
      });

      expect(result).toEqual(updated);
    });

    test("should return null if not found", async () => {
      mockPrisma.income.findFirst.mockResolvedValueOnce(null);

      const result = await updateIncomeByDescription("user-1", "inexistente", {
        amount: 100,
      });

      expect(result).toBeNull();
    });

    test("should update in group context", async () => {
      mockPrisma.income.findFirst.mockResolvedValueOnce({ id: "inc-1" });
      mockPrisma.income.update.mockResolvedValueOnce({});

      await updateIncomeByDescription(
        "user-1",
        "vaquinha",
        { amount: 1000 },
        "group-1"
      );

      expect(mockPrisma.income.findFirst).toHaveBeenCalledWith({
        where: {
          userId: undefined,
          groupId: "group-1",
          description: { contains: "vaquinha", mode: "insensitive" },
        },
        orderBy: { date: "desc" },
      });
    });
  });
});
