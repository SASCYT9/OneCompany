import { PrismaClient } from "@prisma/client";

declare global {
  var __onecompany_prisma: PrismaClient | undefined;
}

/** Compact, value-free description of a query, enough to find its call site. */
export function describeDbOperationArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  const keys = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort().join(",") : "";
  return [
    record.where ? `where:${keys(record.where)}` : "",
    record.select ? `select:${keys(record.select)}` : "",
    record.include ? `include:${keys(record.include)}` : "",
    typeof record.take === "number" ? `take:${record.take}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Prisma Postgres bills every client operation, cached reads included.
  // DB_OP_SAMPLING=0.05 logs ~5% of them as JSON lines (`event: db_op`) so the
  // largest consumers can be ranked from Vercel logs. Unset in normal operation.
  const sampling = Number(process.env.DB_OP_SAMPLING);
  if (!(sampling > 0 && sampling <= 1)) return client;
  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (Math.random() < sampling)
          console.info(
            JSON.stringify({
              event: "db_op",
              model: model ?? "raw",
              operation,
              shape: model ? describeDbOperationArgs(args) : "",
            })
          );
        return query(args);
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma: PrismaClient = global.__onecompany_prisma ?? createPrismaClient();

// Keep one client per warm Node.js isolate in every environment. Next.js can
// evaluate the module from more than one server chunk, and a fresh Prisma
// pool for each copy quickly exhausts a serverless database connection cap.
global.__onecompany_prisma = prisma;
