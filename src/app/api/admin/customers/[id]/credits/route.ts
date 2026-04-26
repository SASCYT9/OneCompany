import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET   /api/admin/customers/[id]/credits   → list customer credits + redemptions
 * POST  /api/admin/customers/[id]/credits   → issue a new credit
 *
 * POST body:
 *   { amount: number, currency: 'EUR'|'USD'|'UAH', type: 'GOODWILL'|...,
 *     reason?: string, notes?: string, expiresAt?: string }
 */

type IssueBody = {
  amount?: number;
  currency?: 'EUR' | 'USD' | 'UAH';
  type?: 'RETURN_REFUND' | 'GOODWILL' | 'PROMOTIONAL' | 'ADJUSTMENT';
  reason?: string;
  notes?: string;
  expiresAt?: string | null;
  relatedOrderId?: string | null;
  relatedReturnId?: string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credits = await (prisma as any).shopCustomerCredit.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        redemptions: {
          orderBy: { redeemedAt: 'desc' },
          take: 10,
          select: { id: true, orderId: true, amount: true, currency: true, redeemedAt: true, note: true },
        },
      },
    });

    // Compute available balance per currency
    const balanceByCurrency: Record<string, number> = {};
    for (const c of credits) {
      if (c.status !== 'ACTIVE' && c.status !== 'PARTIALLY_USED') continue;
      const remaining = Number(c.amount) - Number(c.amountUsed);
      balanceByCurrency[c.currency] = (balanceByCurrency[c.currency] || 0) + remaining;
    }

    return NextResponse.json({
      credits: credits.map(
        (
          c: {
            amount: { toString(): string };
            amountUsed: { toString(): string };
            createdAt: Date;
            updatedAt: Date;
            expiresAt: Date | null;
            redemptions: Array<{ amount: { toString(): string }; redeemedAt: Date }>;
          } & Record<string, unknown>
        ) => ({
          ...c,
          amount: Number(c.amount),
          amountUsed: Number(c.amountUsed),
          remainingAmount: Number(c.amount) - Number(c.amountUsed),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
          redemptions: c.redemptions.map((r) => ({
            ...r,
            amount: Number(r.amount),
            redeemedAt: r.redeemedAt.toISOString(),
          })),
        })
      ),
      balanceByCurrency,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as IssueBody;

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }
    if (!body.currency) return NextResponse.json({ error: 'Currency required' }, { status: 400 });

    const customer = await prisma.shopCustomer.findUnique({ where: { id } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopCustomerCredit.create({
      data: {
        customerId: id,
        amount: body.amount,
        currency: body.currency,
        type: body.type ?? 'GOODWILL',
        status: 'ACTIVE',
        reason: body.reason ?? null,
        notes: body.notes ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        relatedOrderId: body.relatedOrderId ?? null,
        relatedReturnId: body.relatedReturnId ?? null,
        issuedBy: session.email,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.credit.issue',
      entityType: 'shop.customer',
      entityId: id,
      metadata: { amount: body.amount, currency: body.currency, type: body.type, reason: body.reason },
    });

    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to issue credit' }, { status: 500 });
  }
}
