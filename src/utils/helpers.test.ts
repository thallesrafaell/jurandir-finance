import { test, expect, describe } from "bun:test";
import { JURANDIR_PATTERN, extractPhoneFromId, calculateTypingDelay } from "./helpers";

describe("Helpers", () => {
  describe("JURANDIR_PATTERN", () => {
    test("should match 'jurandir' at start of message", () => {
      expect(JURANDIR_PATTERN.test("jurandir listar despesas")).toBe(true);
    });

    test("should match 'Jurandir' with capital letter", () => {
      expect(JURANDIR_PATTERN.test("Jurandir listar despesas")).toBe(true);
    });

    test("should match 'JURANDIR' in uppercase", () => {
      expect(JURANDIR_PATTERN.test("JURANDIR listar despesas")).toBe(true);
    });

    test("should match 'jurandir,' with comma", () => {
      expect(JURANDIR_PATTERN.test("jurandir, listar despesas")).toBe(true);
    });

    test("should match 'jurandir:' with colon", () => {
      expect(JURANDIR_PATTERN.test("jurandir: listar despesas")).toBe(true);
    });

    test("should not match 'jurandir' in middle of message", () => {
      expect(JURANDIR_PATTERN.test("oi jurandir")).toBe(false);
    });

    test("should not match other names", () => {
      expect(JURANDIR_PATTERN.test("maria listar despesas")).toBe(false);
    });
  });

  describe("extractPhoneFromId", () => {
    test("should extract phone from @c.us format", () => {
      const result = extractPhoneFromId("5511999999999@c.us");
      expect(result).toBe("5511999999999");
    });

    test("should extract phone from @lid format", () => {
      const result = extractPhoneFromId("5511999999999@lid");
      expect(result).toBe("5511999999999");
    });

    test("should extract phone from @s.whatsapp.net format", () => {
      const result = extractPhoneFromId("5511999999999@s.whatsapp.net");
      expect(result).toBe("5511999999999");
    });

    test("should return unchanged if no suffix", () => {
      const result = extractPhoneFromId("5511999999999");
      expect(result).toBe("5511999999999");
    });

    test("should handle different phone formats", () => {
      expect(extractPhoneFromId("1234567890@c.us")).toBe("1234567890");
      expect(extractPhoneFromId("551198765432@c.us")).toBe("551198765432");
    });

    test("should not remove @g.us suffix (group)", () => {
      const result = extractPhoneFromId("123456789@g.us");
      expect(result).toBe("123456789@g.us");
    });
  });

  describe("calculateTypingDelay", () => {
    test("should return minimum 500ms for very short text", () => {
      const result = calculateTypingDelay("");
      expect(result).toBe(500);
    });

    test("should return minimum 500ms for short text", () => {
      const result = calculateTypingDelay("Hi");
      expect(result).toBe(500);
    });

    test("should calculate delay based on text length", () => {
      const result = calculateTypingDelay("Hello World!"); // 12 chars * 10 = 120, but min is 500
      expect(result).toBe(500);
    });

    test("should return proportional delay for medium text", () => {
      const text = "a".repeat(100); // 100 chars * 10 = 1000ms
      const result = calculateTypingDelay(text);
      expect(result).toBe(1000);
    });

    test("should return proportional delay for longer text", () => {
      const text = "a".repeat(200); // 200 chars * 10 = 2000ms
      const result = calculateTypingDelay(text);
      expect(result).toBe(2000);
    });

    test("should cap at maximum 3000ms for very long text", () => {
      const text = "a".repeat(500); // 500 chars * 10 = 5000, capped to 3000
      const result = calculateTypingDelay(text);
      expect(result).toBe(3000);
    });

    test("should cap at maximum 3000ms for extremely long text", () => {
      const text = "a".repeat(1000);
      const result = calculateTypingDelay(text);
      expect(result).toBe(3000);
    });

    test("should handle text at boundary (50 chars)", () => {
      const text = "a".repeat(50); // 50 * 10 = 500 (exactly minimum)
      const result = calculateTypingDelay(text);
      expect(result).toBe(500);
    });

    test("should handle text at boundary (300 chars)", () => {
      const text = "a".repeat(300); // 300 * 10 = 3000 (exactly maximum)
      const result = calculateTypingDelay(text);
      expect(result).toBe(3000);
    });
  });
});
