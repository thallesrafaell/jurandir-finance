import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

import { getOrCreateUser, getUserByPhone } from "./users";

describe("Users Service", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("getOrCreateUser", () => {
    test("should create new user with phone only", async () => {
      const mockUser = {
        id: "user-1",
        phone: "5511999999999",
        name: null,
      };

      mockPrisma.user.upsert.mockResolvedValueOnce(mockUser);

      const result = await getOrCreateUser("5511999999999");

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { phone: "5511999999999" },
        update: {},
        create: { phone: "5511999999999", name: undefined },
      });
      expect(result).toEqual(mockUser);
    });

    test("should create user with phone and name", async () => {
      const mockUser = {
        id: "user-1",
        phone: "5511999999999",
        name: "João",
      };

      mockPrisma.user.upsert.mockResolvedValueOnce(mockUser);

      const result = await getOrCreateUser("5511999999999", "João");

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { phone: "5511999999999" },
        update: { name: "João" },
        create: { phone: "5511999999999", name: "João" },
      });
      expect(result).toEqual(mockUser);
    });

    test("should update existing user name", async () => {
      const mockUser = {
        id: "user-1",
        phone: "5511999999999",
        name: "João Silva",
      };

      mockPrisma.user.upsert.mockResolvedValueOnce(mockUser);

      await getOrCreateUser("5511999999999", "João Silva");

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { phone: "5511999999999" },
        update: { name: "João Silva" },
        create: { phone: "5511999999999", name: "João Silva" },
      });
    });
  });

  describe("getUserByPhone", () => {
    test("should find user by phone", async () => {
      const mockUser = {
        id: "user-1",
        phone: "5511999999999",
        name: "João",
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const result = await getUserByPhone("5511999999999");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: "5511999999999" },
      });
      expect(result).toEqual(mockUser);
    });

    test("should return null if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await getUserByPhone("5511000000000");

      expect(result).toBeNull();
    });
  });
});
