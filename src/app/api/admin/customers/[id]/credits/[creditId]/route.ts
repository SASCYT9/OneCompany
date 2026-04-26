import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * PATCH  /api/admin/customers/[id]/credits/[creditId]   → void or update notes
 * POST   /api/admin/customers/[id]/credits/[creditId]?action=redeem  → record manual redemption
 *
 * PATCH body: { status?: 'VOIDED', notes?: string }
 * POST?action=redeem body: { amount: number, orderId?: string, note?: string }
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; creditId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const { creditId } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string; notes?: string };

    const data: Record<string, unknown> = {};
    if (body.status === 'VOIDED') data.status = 'VOIDED';
    if (body.notes !== undefined) data.notes = body.notes;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopCustomerCredit.update({
      where: { id: creditId },
      data,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: data.status === 'VOIDED' ? 'customer.credit.void' : 'customer.credit.update',
      entityType: 'shop.customer-credit',
      entityId: creditId,
      metadata: { updates: Object.keys(data) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to update credit' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; creditId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const action = request.nextUrl.searchParams.get('action');
    if (action !== 'redeem') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { creditId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      amount?: number;
      orderId?: string;
      note?: string;
    };

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credit = await (prisma as any).shopCustomerCredit.findUnique({ where: { id: creditId } });
    if (!credit) return NextResponse.json({ error: 'Credit not found' }, { status: 404 });

    if (credit.status === 'VOIDED' || credit.status === 'EXPIRED' || credit.status === 'FULLY_USED') {
      return NextResponse.json({ error: `Cannot redeem ${credit.status} credit` }, { status: 400 });
    }

    const remaining = Number(credit.amount) - Number(credit.amountUsed);
    if (body.amount > remaining) {
      return NextResponse.json({ error: `Only ${remaining} ${credit.currency} remaining` }, { status: 400 });
    }

    const newAmountUsed = Number(credit.amountUsed) + body.amount;
    const newStatus = newAmountUsed >= Number(credit.amount) ? 'FULLY_USED' : 'PARTIALLY_USED';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$transaction([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).shopCustomerCredit.update({
        where: { id: creditId },
        data: {
          amountUsed: newAmountUsed,
          status: newStatus,
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).shopCustomerCreditRedemption.create({
        data: {
          creditId,
          amount: body.amount,
          currency: credit.currency,
          orderId: body.orderId ?? null,
          note: body.note ?? null,
          redeemedBy: session.email,
        },
      }),
    ]);

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.credit.redeem',
      entityType: 'shop.customer-credit',
      entityId: creditId,
      metadata: { amount: body.amount, orderId: body.orderId },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to redeem' }, { status: 500 });
  }
}
