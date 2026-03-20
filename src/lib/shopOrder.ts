/**
 * Shop order helpers: order number generation, view token.
 */

import { OrderStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

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

export async function generateOrderNumberForStore(_storeKey?: string): Promise<string> {
  return generateOrderNumber();
}

/** Generate a secure token for guest order view (e.g. in confirmation email). */
export function generateViewToken(): string {
  return randomBytes(24).toString('base64url');
}

export function buildInitialOrderEventData(
  orderId: string,
  status: OrderStatus,
  actorName = 'checkout'
) {
  return {
    orderId,
    fromStatus: null,
    toStatus: status,
    actorType: 'system',
    actorName,
    note:
      status === 'PENDING_PAYMENT'
        ? 'Order created from storefront checkout and is waiting for payment.'
        : 'Order created from storefront checkout.',
  };
}
