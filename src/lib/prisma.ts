import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __onecompany_prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__onecompany_prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__onecompany_prisma = prisma;
}

