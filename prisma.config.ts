import { defineConfig } from "prisma/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envPath = resolve(import.meta.dirname, ".env");
  if (existsSync(envPath)) {
    const envText = readFileSync(envPath, "utf-8");
    const url = envText
      .split("\n")
      .find((line) => line.startsWith("DATABASE_URL"))
      ?.split("=")[1]
      ?.replace(/"/g, "")
      .trim();
    if (url) return url;
  }

  throw new Error("DATABASE_URL not found");
}

const DATABASE_URL = getDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL!,
  },
});
