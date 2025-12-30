import { defineConfig } from "prisma/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, ".env");
const envText = readFileSync(envPath, "utf-8");
const DATABASE_URL = envText
  .split("\n")
  .find((line) => line.startsWith("DATABASE_URL"))
  ?.split("=")[1]
  ?.replace(/"/g, "")
  .trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL!,
  },
});
