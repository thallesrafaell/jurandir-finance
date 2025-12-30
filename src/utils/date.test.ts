import { test, expect } from "bun:test";
import { getMonthRange } from "./date";

test("getMonthRange returns correct range for current month", () => {
  const now = new Date();
  const result = getMonthRange();

  expect(result.month).toBe(now.getMonth() + 1);
  expect(result.year).toBe(now.getFullYear());
  expect(result.startDate.getDate()).toBe(1);
});

test("getMonthRange returns correct range for specific month", () => {
  const result = getMonthRange(6, 2025);

  expect(result.month).toBe(6);
  expect(result.year).toBe(2025);
  expect(result.startDate).toEqual(new Date(2025, 5, 1));
  expect(result.endDate.getMonth()).toBe(5);
});
