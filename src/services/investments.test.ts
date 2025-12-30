import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

import {
  addInvestment,
  getInvestments,
  updateInvestmentValue,
  getInvestmentSummary,
  deleteInvestment,
} from "./investments";

describe("Investments Service", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("addInvestment", () => {
    test("should create investment with all parameters", async () => {
      const mockInvestment = {
        id: "inv-1",
        userId: "user-1",
        name: "PETR4",
        type: "stocks",
        amount: 1000,
        currentValue: 1200,
        purchaseDate: new Date("2025-01-01"),
      };

      mockPrisma.investment.create.mockResolvedValueOnce(mockInvestment);

      const result = await addInvestment(
        "user-1",
        "PETR4",
        "stocks",
        1000,
        1200,
        new Date("2025-01-01")
      );

      expect(mockPrisma.investment.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "PETR4",
          type: "stocks",
          amount: 1000,
          currentValue: 1200,
          purchaseDate: new Date("2025-01-01"),
        },
      });
      expect(result).toEqual(mockInvestment);
    });

    test("should create investment with default currentValue equal to amount", async () => {
      mockPrisma.investment.create.mockResolvedValueOnce({});

      await addInvestment("user-1", "Bitcoin", "crypto", 5000);

      expect(mockPrisma.investment.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "Bitcoin",
          type: "crypto",
          amount: 5000,
          currentValue: 5000,
          purchaseDate: expect.any(Date),
        },
      });
    });

    test("should create fixed income investment", async () => {
      mockPrisma.investment.create.mockResolvedValueOnce({});

      await addInvestment("user-1", "CDB 120%", "fixed_income", 10000);

      expect(mockPrisma.investment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "fixed_income",
        }),
      });
    });
  });

  describe("getInvestments", () => {
    test("should get all investments for user", async () => {
      const mockInvestments = [
        { id: "1", name: "PETR4", type: "stocks", amount: 1000 },
        { id: "2", name: "Bitcoin", type: "crypto", amount: 5000 },
      ];

      mockPrisma.investment.findMany.mockResolvedValueOnce(mockInvestments);

      const result = await getInvestments("user-1");

      expect(mockPrisma.investment.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(mockInvestments);
    });

    test("should filter by type", async () => {
      mockPrisma.investment.findMany.mockResolvedValueOnce([]);

      await getInvestments("user-1", "stocks");

      expect(mockPrisma.investment.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", type: "stocks" },
        orderBy: { createdAt: "desc" },
      });
    });

    test("should filter by crypto type", async () => {
      mockPrisma.investment.findMany.mockResolvedValueOnce([]);

      await getInvestments("user-1", "crypto");

      expect(mockPrisma.investment.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", type: "crypto" },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("updateInvestmentValue", () => {
    test("should update investment current value", async () => {
      const updated = { id: "inv-1", currentValue: 1500 };
      mockPrisma.investment.update.mockResolvedValueOnce(updated);

      const result = await updateInvestmentValue("inv-1", "user-1", 1500);

      expect(mockPrisma.investment.update).toHaveBeenCalledWith({
        where: { id: "inv-1", userId: "user-1" },
        data: { currentValue: 1500 },
      });
      expect(result).toEqual(updated);
    });
  });

  describe("getInvestmentSummary", () => {
    test("should calculate summary with profit", async () => {
      const mockInvestments = [
        { id: "1", type: "stocks", amount: 1000, currentValue: 1200 },
        { id: "2", type: "stocks", amount: 2000, currentValue: 2500 },
        { id: "3", type: "crypto", amount: 3000, currentValue: 4000 },
      ];

      mockPrisma.investment.findMany.mockResolvedValueOnce(mockInvestments);

      const result = await getInvestmentSummary("user-1");

      expect(result.totalInvested).toBe(6000);
      expect(result.totalCurrentValue).toBe(7700);
      expect(result.totalReturn).toBe(1700);
      expect(result.returnPercentage).toBeCloseTo(28.33, 1);
      expect(result.byType).toEqual({
        stocks: { invested: 3000, currentValue: 3700 },
        crypto: { invested: 3000, currentValue: 4000 },
      });
    });

    test("should calculate summary with loss", async () => {
      const mockInvestments = [
        { id: "1", type: "crypto", amount: 5000, currentValue: 3000 },
      ];

      mockPrisma.investment.findMany.mockResolvedValueOnce(mockInvestments);

      const result = await getInvestmentSummary("user-1");

      expect(result.totalInvested).toBe(5000);
      expect(result.totalCurrentValue).toBe(3000);
      expect(result.totalReturn).toBe(-2000);
      expect(result.returnPercentage).toBe(-40);
    });

    test("should return zero percentage when no investments", async () => {
      mockPrisma.investment.findMany.mockResolvedValueOnce([]);

      const result = await getInvestmentSummary("user-1");

      expect(result.totalInvested).toBe(0);
      expect(result.totalCurrentValue).toBe(0);
      expect(result.totalReturn).toBe(0);
      expect(result.returnPercentage).toBe(0);
      expect(result.byType).toEqual({});
    });

    test("should group by multiple types", async () => {
      const mockInvestments = [
        { id: "1", type: "stocks", amount: 1000, currentValue: 1100 },
        { id: "2", type: "fixed_income", amount: 5000, currentValue: 5200 },
        { id: "3", type: "funds", amount: 2000, currentValue: 2100 },
        { id: "4", type: "other", amount: 500, currentValue: 600 },
      ];

      mockPrisma.investment.findMany.mockResolvedValueOnce(mockInvestments);

      const result = await getInvestmentSummary("user-1");

      expect(Object.keys(result.byType)).toHaveLength(4);
      expect(result.byType.stocks).toEqual({ invested: 1000, currentValue: 1100 });
      expect(result.byType.fixed_income).toEqual({ invested: 5000, currentValue: 5200 });
      expect(result.byType.funds).toEqual({ invested: 2000, currentValue: 2100 });
      expect(result.byType.other).toEqual({ invested: 500, currentValue: 600 });
    });
  });

  describe("deleteInvestment", () => {
    test("should delete investment by id", async () => {
      const deleted = { id: "inv-1", name: "PETR4" };
      mockPrisma.investment.delete.mockResolvedValueOnce(deleted);

      const result = await deleteInvestment("inv-1", "user-1");

      expect(mockPrisma.investment.delete).toHaveBeenCalledWith({
        where: { id: "inv-1", userId: "user-1" },
      });
      expect(result).toEqual(deleted);
    });
  });
});
