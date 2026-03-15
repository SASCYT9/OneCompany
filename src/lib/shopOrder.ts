/**
 * Shop order helpers: order number generation, view token.
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/** Generate next order number for current year: OC-YYYY-NNNNN */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;
  const last = await prisma.shopOrder.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const nextNum = last
    ? parseInt(last.orderNumber.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

/** Generate a secure token for guest order view (e.g. in confirmation email). */
export function generateViewToken(): string {
  return randomBytes(24).toString('base64url');
}
