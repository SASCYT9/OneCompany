import { PrismaClient } from "@prisma/client";

declare global {
  var __onecompany_prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__onecompany_prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Keep one client per warm Node.js isolate in every environment. Next.js can
// evaluate the module from more than one server chunk, and a fresh Prisma
// pool for each copy quickly exhausts a serverless database connection cap.
global.__onecompany_prisma = prisma;
