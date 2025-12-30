import { test, expect, describe } from "bun:test";
import { getMonthRange } from "./date";

describe("getMonthRange", () => {
  describe("current month (no parameters)", () => {
    test("should return correct month and year", () => {
      const now = new Date();
      const result = getMonthRange();

      expect(result.month).toBe(now.getMonth() + 1);
      expect(result.year).toBe(now.getFullYear());
    });

    test("should set startDate to first day of month", () => {
      const result = getMonthRange();

      expect(result.startDate.getDate()).toBe(1);
      expect(result.startDate.getHours()).toBe(0);
      expect(result.startDate.getMinutes()).toBe(0);
      expect(result.startDate.getSeconds()).toBe(0);
    });
  });

  describe("specific month and year", () => {
    test("should return correct range for June 2025", () => {
      const result = getMonthRange(6, 2025);

      expect(result.month).toBe(6);
      expect(result.year).toBe(2025);
      expect(result.startDate).toEqual(new Date(2025, 5, 1));
      expect(result.endDate.getMonth()).toBe(5);
    });

    test("should return correct range for January", () => {
      const result = getMonthRange(1, 2025);

      expect(result.month).toBe(1);
      expect(result.year).toBe(2025);
      expect(result.startDate).toEqual(new Date(2025, 0, 1));
      expect(result.endDate.getDate()).toBe(31);
    });

    test("should return correct range for December", () => {
      const result = getMonthRange(12, 2025);

      expect(result.month).toBe(12);
      expect(result.year).toBe(2025);
      expect(result.startDate).toEqual(new Date(2025, 11, 1));
      expect(result.endDate.getDate()).toBe(31);
    });
  });

  describe("months with different lengths", () => {
    test("should handle 30-day month (April)", () => {
      const result = getMonthRange(4, 2025);

      expect(result.endDate.getDate()).toBe(30);
      expect(result.endDate.getMonth()).toBe(3);
    });

    test("should handle 31-day month (July)", () => {
      const result = getMonthRange(7, 2025);

      expect(result.endDate.getDate()).toBe(31);
      expect(result.endDate.getMonth()).toBe(6);
    });

    test("should handle February non-leap year (28 days)", () => {
      const result = getMonthRange(2, 2025);

      expect(result.endDate.getDate()).toBe(28);
      expect(result.endDate.getMonth()).toBe(1);
    });

    test("should handle February leap year (29 days)", () => {
      const result = getMonthRange(2, 2024);

      expect(result.endDate.getDate()).toBe(29);
      expect(result.endDate.getMonth()).toBe(1);
    });
  });

  describe("end date time boundaries", () => {
    test("should set endDate to end of day (23:59:59)", () => {
      const result = getMonthRange(1, 2025);

      expect(result.endDate.getHours()).toBe(23);
      expect(result.endDate.getMinutes()).toBe(59);
      expect(result.endDate.getSeconds()).toBe(59);
    });
  });

  describe("edge cases", () => {
    test("should handle year boundary correctly", () => {
      const resultDec = getMonthRange(12, 2024);
      const resultJan = getMonthRange(1, 2025);

      expect(resultDec.year).toBe(2024);
      expect(resultJan.year).toBe(2025);
    });

    test("should handle very old year", () => {
      const result = getMonthRange(6, 2000);

      expect(result.year).toBe(2000);
      expect(result.month).toBe(6);
    });

    test("should handle future year", () => {
      const result = getMonthRange(6, 2030);

      expect(result.year).toBe(2030);
      expect(result.month).toBe(6);
    });
  });

  describe("partial parameters", () => {
    test("should use current year when only month provided", () => {
      const now = new Date();
      const result = getMonthRange(6);

      expect(result.month).toBe(6);
      expect(result.year).toBe(now.getFullYear());
    });
  });
});
