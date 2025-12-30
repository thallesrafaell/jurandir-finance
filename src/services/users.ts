import { prisma } from "../db";

export async function getOrCreateUser(phone: string, name?: string) {
  return prisma.user.upsert({
    where: { phone },
    update: { ...(name && { name }) },
    create: { phone, name },
  });
}

export async function getUserByPhone(phone: string) {
  return prisma.user.findUnique({
    where: { phone },
  });
}
