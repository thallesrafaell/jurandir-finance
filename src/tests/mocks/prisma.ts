import { mock } from "bun:test";

export const mockPrismaExpense = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
  findFirst: mock(() => Promise.resolve(null)),
  groupBy: mock(() => Promise.resolve([])),
  update: mock(() => Promise.resolve({})),
  delete: mock(() => Promise.resolve({})),
  deleteMany: mock(() => Promise.resolve({ count: 0 })),
};

export const mockPrismaIncome = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
  findFirst: mock(() => Promise.resolve(null)),
  groupBy: mock(() => Promise.resolve([])),
  aggregate: mock(() => Promise.resolve({ _sum: { amount: 0 } })),
  update: mock(() => Promise.resolve({})),
  delete: mock(() => Promise.resolve({})),
  deleteMany: mock(() => Promise.resolve({ count: 0 })),
};

export const mockPrismaUser = {
  upsert: mock(() => Promise.resolve({})),
  findUnique: mock(() => Promise.resolve(null)),
  create: mock(() => Promise.resolve({})),
};

export const mockPrismaGroup = {
  upsert: mock(() => Promise.resolve({})),
  findUnique: mock(() => Promise.resolve(null)),
};

export const mockPrismaGroupMember = {
  upsert: mock(() => Promise.resolve({})),
  findUnique: mock(() => Promise.resolve(null)),
  findFirst: mock(() => Promise.resolve(null)),
  findMany: mock(() => Promise.resolve([])),
  delete: mock(() => Promise.resolve({})),
  create: mock(() => Promise.resolve({})),
};

export const mockPrismaBudget = {
  upsert: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
  findFirst: mock(() => Promise.resolve(null)),
  delete: mock(() => Promise.resolve({})),
};

export const mockPrismaInvestment = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
  findFirst: mock(() => Promise.resolve(null)),
  update: mock(() => Promise.resolve({})),
  delete: mock(() => Promise.resolve({})),
  aggregate: mock(() => Promise.resolve({ _sum: { amount: 0, currentValue: 0 } })),
  groupBy: mock(() => Promise.resolve([])),
};

export const mockPrisma = {
  expense: mockPrismaExpense,
  income: mockPrismaIncome,
  user: mockPrismaUser,
  group: mockPrismaGroup,
  groupMember: mockPrismaGroupMember,
  budget: mockPrismaBudget,
  investment: mockPrismaInvestment,
};

export function resetAllMocks() {
  Object.values(mockPrismaExpense).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaIncome).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaUser).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaGroup).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaGroupMember).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaBudget).forEach((fn) => fn.mockReset());
  Object.values(mockPrismaInvestment).forEach((fn) => fn.mockReset());
}
