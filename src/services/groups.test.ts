import { test, expect, describe, beforeEach, mock } from "bun:test";
import { mockPrisma, resetAllMocks } from "../tests/mocks/prisma";

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

import {
  upsertGroup,
  getGroup,
  addMember,
  removeMember,
  isMember,
  getMembers,
  getUserGroups,
  validateGroupAccess,
  ensureMember,
  findMemberByName,
  createVirtualMember,
  findOrCreateMemberByName,
  calculateSplit,
} from "./groups";

describe("Groups Service", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe("upsertGroup", () => {
    test("should create or update group", async () => {
      const mockGroup = { id: "group-1", name: "Familia" };
      mockPrisma.group.upsert.mockResolvedValueOnce(mockGroup);

      const result = await upsertGroup("group-1", "Familia");

      expect(mockPrisma.group.upsert).toHaveBeenCalledWith({
        where: { id: "group-1" },
        update: { name: "Familia" },
        create: { id: "group-1", name: "Familia" },
      });
      expect(result).toEqual(mockGroup);
    });
  });

  describe("getGroup", () => {
    test("should get group with members", async () => {
      const mockGroup = {
        id: "group-1",
        name: "Familia",
        members: [{ user: { id: "user-1", name: "João" } }],
      };
      mockPrisma.group.findUnique.mockResolvedValueOnce(mockGroup);

      const result = await getGroup("group-1");

      expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({
        where: { id: "group-1" },
        include: { members: { include: { user: true } } },
      });
      expect(result).toEqual(mockGroup);
    });
  });

  describe("addMember", () => {
    test("should add member with default role", async () => {
      mockPrisma.group.upsert.mockResolvedValueOnce({});
      mockPrisma.groupMember.upsert.mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
        role: "member",
      });

      const result = await addMember("group-1", "user-1");

      expect(mockPrisma.groupMember.upsert).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: "group-1", userId: "user-1" } },
        update: { role: "member" },
        create: { groupId: "group-1", userId: "user-1", role: "member" },
      });
      expect(result.role).toBe("member");
    });

    test("should add member as admin", async () => {
      mockPrisma.group.upsert.mockResolvedValueOnce({});
      mockPrisma.groupMember.upsert.mockResolvedValueOnce({ role: "admin" });

      await addMember("group-1", "user-1", "admin");

      expect(mockPrisma.groupMember.upsert).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: "group-1", userId: "user-1" } },
        update: { role: "admin" },
        create: { groupId: "group-1", userId: "user-1", role: "admin" },
      });
    });
  });

  describe("removeMember", () => {
    test("should remove member from group", async () => {
      mockPrisma.groupMember.delete.mockResolvedValueOnce({});

      await removeMember("group-1", "user-1");

      expect(mockPrisma.groupMember.delete).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: "group-1", userId: "user-1" } },
      });
    });
  });

  describe("isMember", () => {
    test("should return true if user is member", async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
      });

      const result = await isMember("group-1", "user-1");

      expect(result).toBe(true);
    });

    test("should return false if user is not member", async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValueOnce(null);

      const result = await isMember("group-1", "user-2");

      expect(result).toBe(false);
    });
  });

  describe("getMembers", () => {
    test("should get all members of group", async () => {
      const mockMembers = [
        { userId: "user-1", user: { name: "João" } },
        { userId: "user-2", user: { name: "Maria" } },
      ];
      mockPrisma.groupMember.findMany.mockResolvedValueOnce(mockMembers);

      const result = await getMembers("group-1");

      expect(mockPrisma.groupMember.findMany).toHaveBeenCalledWith({
        where: { groupId: "group-1" },
        include: { user: true },
      });
      expect(result).toEqual(mockMembers);
    });
  });

  describe("getUserGroups", () => {
    test("should get all groups for user", async () => {
      const mockGroups = [
        { groupId: "group-1", group: { name: "Familia" } },
        { groupId: "group-2", group: { name: "Amigos" } },
      ];
      mockPrisma.groupMember.findMany.mockResolvedValueOnce(mockGroups);

      const result = await getUserGroups("user-1");

      expect(mockPrisma.groupMember.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: { group: true },
      });
      expect(result).toEqual(mockGroups);
    });
  });

  describe("validateGroupAccess", () => {
    test("should validate group access", async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValueOnce({});

      const result = await validateGroupAccess("group-1", "user-1");

      expect(result).toBe(true);
    });
  });

  describe("ensureMember", () => {
    test("should ensure user is member of group", async () => {
      mockPrisma.group.upsert.mockResolvedValueOnce({});
      mockPrisma.groupMember.upsert.mockResolvedValueOnce({
        groupId: "group-1",
        userId: "user-1",
      });

      await ensureMember("group-1", "user-1", "Familia");

      expect(mockPrisma.group.upsert).toHaveBeenCalledWith({
        where: { id: "group-1" },
        update: { name: "Familia" },
        create: { id: "group-1", name: "Familia" },
      });
    });
  });

  describe("findMemberByName", () => {
    test("should find member by exact name match", async () => {
      mockPrisma.groupMember.findMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "João Silva" } },
        { userId: "user-2", user: { name: "Maria Santos" } },
      ]);

      const result = await findMemberByName("group-1", "João Silva");

      expect(result).toBe("user-1");
    });

    test("should find member by partial name match", async () => {
      mockPrisma.groupMember.findMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "João Silva" } },
        { userId: "user-2", user: { name: "Maria Santos" } },
      ]);

      const result = await findMemberByName("group-1", "joão");

      expect(result).toBe("user-1");
    });

    test("should return null if no match found", async () => {
      mockPrisma.groupMember.findMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "João" } },
      ]);

      const result = await findMemberByName("group-1", "Pedro");

      expect(result).toBeNull();
    });

    test("should handle case insensitive search", async () => {
      mockPrisma.groupMember.findMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "MARIA" } },
      ]);

      const result = await findMemberByName("group-1", "maria");

      expect(result).toBe("user-1");
    });
  });

  describe("createVirtualMember", () => {
    test("should create virtual member with fake phone", async () => {
      const mockUser = { id: "virtual-user-1" };
      mockPrisma.user.create.mockImplementation(() => Promise.resolve(mockUser));
      mockPrisma.groupMember.create.mockImplementation(() => Promise.resolve({}));

      const result = await createVirtualMember("group-1", "Pedro");

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          phone: expect.stringContaining("virtual_pedro_"),
          name: "Pedro",
        },
      });
      expect(result).toBe("virtual-user-1");
    });

    test("should sanitize name with spaces", async () => {
      mockPrisma.user.create.mockImplementation(() => Promise.resolve({ id: "user-1" }));
      mockPrisma.groupMember.create.mockImplementation(() => Promise.resolve({}));

      await createVirtualMember("group-1", "João Silva");

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          phone: expect.stringContaining("virtual_joão_silva_"),
          name: "João Silva",
        },
      });
    });
  });

  describe("findOrCreateMemberByName", () => {
    test("should return existing member if found", async () => {
      mockPrisma.groupMember.findMany.mockImplementation(() =>
        Promise.resolve([{ userId: "existing-user", user: { name: "João" } }])
      );

      const result = await findOrCreateMemberByName("group-1", "João");

      expect(result).toBe("existing-user");
    });

    test("should create virtual member if not found", async () => {
      mockPrisma.groupMember.findMany.mockImplementation(() => Promise.resolve([]));
      mockPrisma.user.create.mockImplementation(() => Promise.resolve({ id: "new-virtual-user" }));
      mockPrisma.groupMember.create.mockImplementation(() => Promise.resolve({}));

      const result = await findOrCreateMemberByName("group-1", "Pedro");

      expect(result).toBe("new-virtual-user");
    });
  });

});
