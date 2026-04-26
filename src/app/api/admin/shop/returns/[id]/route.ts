import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET    /api/admin/shop/returns/[id]   → full RMA detail
 * PATCH  /api/admin/shop/returns/[id]   → update status / notes / refund metadata
 *
 * Status workflow:
 *   REQUESTED → APPROVED | REJECTED
 *   APPROVED  → IN_TRANSIT | REJECTED
 *   IN_TRANSIT → RECEIVED
 *   RECEIVED  → INSPECTED
 *   INSPECTED → REFUNDED
 *
 * Side effects per transition:
 *   APPROVED  → set approvedAt
 *   IN_TRANSIT → set inTransitAt
 *   RECEIVED  → set receivedAt; if restockOnReceive: increment inventory levels for each item
 *   INSPECTED → set inspectedAt
 *   REFUNDED  → set refundedAt + record externalRefundId; (Stripe call is left to caller for now)
 *   REJECTED  → set rejectedAt
 */

type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'INSPECTED' | 'REFUNDED' | 'REJECTED';

const ALLOWED_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_TRANSIT', 'REJECTED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTED'],
  INSPECTED: ['REFUNDED'],
  REFUNDED: [],
  REJECTED: [],
};

type PatchBody = {
  status?: ReturnStatus;
  reasonNote?: string | null;
  adminNote?: string | null;
  customerNote?: string | null;
  refundMethod?: 'STRIPE_REFUND' | 'STORE_CREDIT' | 'BANK_TRANSFER' | 'REPLACEMENT' | 'NONE';
  refundAmount?: number;
  externalRefundId?: string | null;
  restockOnReceive?: boolean;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ret = await (prisma as any).shopOrderReturn.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            email: true,
            customerName: true,
            currency: true,
            total: true,
            customerGroupSnapshot: true,
            customerId: true,
            shippingAddress: true,
            createdAt: true,
            paymentStatus: true,
            amountPaid: true,
          },
        },
        items: true,
      },
    });

    if (!ret) return NextResponse.json({ error: 'Return not found' }, { status: 404 });

    const allowedNext = ALLOWED_TRANSITIONS[ret.status as ReturnStatus] || [];

    return NextResponse.json({
      ...ret,
      order: {
        ...ret.order,
        total: Number(ret.order.total),
        createdAt: ret.order.createdAt.toISOString(),
      },
      items: ret.items.map((it: { unitPrice: { toString(): string }; refundAmount: { toString(): string }; restockedAt: Date | null } & Record<string, unknown>) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        refundAmount: Number(it.refundAmount),
        restockedAt: it.restockedAt ? it.restockedAt.toISOString() : null,
      })),
      refundAmount: Number(ret.refundAmount),
      allowedNextStatuses: allowedNext,
      createdAt: ret.createdAt.toISOString(),
      updatedAt: ret.updatedAt.toISOString(),
      requestedAt: ret.requestedAt ? ret.requestedAt.toISOString() : null,
      approvedAt: ret.approvedAt ? ret.approvedAt.toISOString() : null,
      inTransitAt: ret.inTransitAt ? ret.inTransitAt.toISOString() : null,
      receivedAt: ret.receivedAt ? ret.receivedAt.toISOString() : null,
      inspectedAt: ret.inspectedAt ? ret.inspectedAt.toISOString() : null,
      refundedAt: ret.refundedAt ? ret.refundedAt.toISOString() : null,
      rejectedAt: ret.rejectedAt ? ret.rejectedAt.toISOString() : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Return GET error:', error);
    return NextResponse.json({ error: 'Failed to load return' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as PatchBody;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = await (prisma as any).shopOrderReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!current) return NextResponse.json({ error: 'Return not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    const now = new Date();

    if (body.status && body.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status as ReturnStatus] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${current.status} to ${body.status}` },
          { status: 400 }
        );
      }

      data.status = body.status;
      switch (body.status) {
        case 'APPROVED':
          data.approvedAt = now;
          break;
        case 'IN_TRANSIT':
          data.inTransitAt = now;
          break;
        case 'RECEIVED':
          data.receivedAt = now;
          break;
        case 'INSPECTED':
          data.inspectedAt = now;
          break;
        case 'REFUNDED':
          data.refundedAt = now;
          if (body.externalRefundId !== undefined) data.externalRefundId = body.externalRefundId;
          break;
        case 'REJECTED':
          data.rejectedAt = now;
          break;
      }
    }

    if (body.reasonNote !== undefined) data.reasonNote = body.reasonNote;
    if (body.adminNote !== undefined) data.adminNote = body.adminNote;
    if (body.customerNote !== undefined) data.customerNote = body.customerNote;
    if (body.refundMethod !== undefined) data.refundMethod = body.refundMethod;
    if (body.refundAmount !== undefined) data.refundAmount = body.refundAmount;
    if (body.externalRefundId !== undefined) data.externalRefundId = body.externalRefundId;
    if (body.restockOnReceive !== undefined) data.restockOnReceive = body.restockOnReceive;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).shopOrderReturn.update({
      where: { id },
      data,
    });

    // Side effect: restock on RECEIVED if flag set
    if (body.status === 'RECEIVED' && current.restockOnReceive) {
      try {
        // For each item with a variantId, increment inventory at first available location
        for (const it of current.items) {
          if (!it.variantId) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const level = await (prisma as any).shopInventoryLevel.findFirst({
            where: { variantId: it.variantId },
          });
          if (level) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).shopInventoryLevel.update({
              where: { id: level.id },
              data: { stockedQuantity: { increment: it.quantity } },
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).shopOrderReturnItem.update({
              where: { id: it.id },
              data: { restockedAt: now, restockLocationId: level.locationId },
            });
          }
        }
      } catch (restockError) {
        console.error('Restock failed (return marked RECEIVED anyway):', restockError);
      }
    }

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: body.status ? `return.status.${body.status.toLowerCase()}` : 'return.update',
      entityType: 'shop.return',
      entityId: id,
      metadata: { fromStatus: current.status, toStatus: body.status, updates: Object.keys(data) },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Return PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update return' }, { status: 500 });
  }
}
