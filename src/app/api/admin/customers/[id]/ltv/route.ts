import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * Computes LTV stats for a customer:
 *   - lifetime spend
 *   - paid orders count
 *   - AOV
 *   - last/first order dates
 *   - days since last order
 *   - retention score (heuristic 0–100 from recency + frequency)
 *   - active credit balance
 *
 * Uses the customer's most recent order currency as display currency
 * (a multi-currency customer is rare; pick the most-used one).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const { id } = await params;
    const orders = await prisma.shopOrder.findMany({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        currency: true,
        total: true,
        amountPaid: true,
        paymentStatus: true,
        createdAt: true,
      },
    });

    if (orders.length === 0) {
      return NextResponse.json({
        totalSpent: 0,
        ordersCount: 0,
        paidOrdersCount: 0,
        averageOrderValue: 0,
        daysSinceLastOrder: null,
        lastOrderAt: null,
        firstOrderAt: null,
        retentionScore: 0,
        currency: 'EUR',
        creditBalance: 0,
      });
    }

    // Pick most-frequent currency
    const currencyCounts = new Map<string, number>();
    for (const o of orders) currencyCounts.set(o.currency, (currencyCounts.get(o.currency) || 0) + 1);
    let currency = 'EUR';
    let bestCount = 0;
    for (const [c, n] of currencyCounts) {
      if (n > bestCount) {
        currency = c;
        bestCount = n;
      }
    }

    const ordersInCurrency = orders.filter((o) => o.currency === currency);
    const totalSpent = ordersInCurrency.reduce((sum, o) => sum + o.amountPaid, 0);
    const paidOrders = ordersInCurrency.filter((o) => o.paymentStatus === 'PAID');
    const aov = paidOrders.length > 0 ? totalSpent / paidOrders.length : 0;
    const lastOrder = orders[0];
    const firstOrder = orders[orders.length - 1];
    const daysSince = Math.floor((Date.now() - lastOrder.createdAt.getTime()) / 86_400_000);

    // Retention heuristic:
    //   recency factor: 1.0 if last order < 30d, 0.5 if 30–90d, 0.2 if 90–180d, 0 if >180d
    //   frequency factor: orders per month over the customer's active period
    let recency = 1;
    if (daysSince > 30) recency = 0.5;
    if (daysSince > 90) recency = 0.2;
    if (daysSince > 180) recency = 0;

    const tenureMonths = Math.max(1, Math.floor((Date.now() - firstOrder.createdAt.getTime()) / (86_400_000 * 30)));
    const ordersPerMonth = orders.length / tenureMonths;
    const frequency = Math.min(1, ordersPerMonth / 2); // 2+ orders/month = max
    const retentionScore = Math.round((recency * 0.6 + frequency * 0.4) * 100);

    // Active credit balance — sum of (amount - amountUsed) for ACTIVE/PARTIALLY_USED credits in this currency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credits = (await (prisma as any).shopCustomerCredit.findMany({
      where: {
        customerId: id,
        currency,
        status: { in: ['ACTIVE', 'PARTIALLY_USED'] },
      },
      select: { amount: true, amountUsed: true },
    })) as Array<{ amount: { toString(): string }; amountUsed: { toString(): string } }>;
    const creditBalance = credits.reduce((sum, c) => sum + (Number(c.amount) - Number(c.amountUsed)), 0);

    return NextResponse.json({
      totalSpent,
      ordersCount: orders.length,
      paidOrdersCount: paidOrders.length,
      averageOrderValue: aov,
      daysSinceLastOrder: daysSince,
      lastOrderAt: lastOrder.createdAt.toISOString(),
      firstOrderAt: firstOrder.createdAt.toISOString(),
      retentionScore,
      currency,
      creditBalance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('LTV error:', error);
    return NextResponse.json({ error: 'Failed to compute LTV' }, { status: 500 });
  }
}
