import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/admin/shop/returns          → list RMAs with filters
 * POST /api/admin/shop/returns          → create RMA from an existing order (status REQUESTED)
 *
 * GET filters:
 *   ?status=REQUESTED|APPROVED|...
 *   ?search={rmaNumber|orderNumber}
 *   ?orderId={...}
 *
 * POST body:
 *   { orderId, reason, reasonNote?, customerNote?, items: [{ orderItemId, quantity, refundAmount, conditionNote? }] }
 */

type ReturnReason =
  | 'WRONG_ITEM'
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'NOT_AS_DESCRIBED'
  | 'CHANGED_MIND'
  | 'ORDERING_ERROR'
  | 'OTHER';

type CreateReturnBody = {
  orderId?: string;
  reason?: ReturnReason;
  reasonNote?: string | null;
  customerNote?: string | null;
  refundMethod?: 'STRIPE_REFUND' | 'STORE_CREDIT' | 'BANK_TRANSFER' | 'REPLACEMENT' | 'NONE';
  restockOnReceive?: boolean;
  items?: Array<{
    orderItemId: string;
    quantity: number;
    refundAmount: number;
    reason?: ReturnReason;
    conditionNote?: string | null;
  }>;
};

function generateRmaNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RMA-${year}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search')?.trim() || '';
    const orderId = searchParams.get('orderId') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (orderId) where.orderId = orderId;
    if (search) {
      where.OR = [
        { rmaNumber: { contains: search.toUpperCase(), mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
        { order: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const returns = await (prisma as any).shopOrderReturn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        order: { select: { orderNumber: true, email: true, customerName: true, currency: true, total: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      returns: returns.map(
        (
          r: Record<string, unknown> & {
            order: { orderNumber: string; email: string; customerName: string; currency: string; total: number | { toString(): string } };
            _count?: { items: number };
            createdAt: Date;
            requestedAt: Date | null;
            approvedAt: Date | null;
            receivedAt: Date | null;
            refundedAt: Date | null;
            updatedAt: Date;
          }
        ) => ({
          ...r,
          order: {
            ...r.order,
            total: typeof r.order.total === 'object' ? Number(r.order.total) : r.order.total,
          },
          itemsCount: r._count?.items ?? 0,
          refundAmount: r.refundAmount != null ? Number(r.refundAmount) : 0,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          requestedAt: r.requestedAt ? r.requestedAt.toISOString() : null,
          approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
          receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
          refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Returns list error:', error);
    return NextResponse.json({ error: 'Failed to load returns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const body = (await request.json().catch(() => ({}))) as CreateReturnBody;
    if (!body.orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const order = await prisma.shopOrder.findUnique({
      where: { id: body.orderId },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Validate item refs and quantities
    const itemMap = new Map(order.items.map((it) => [it.id, it]));
    let totalRefund = 0;
    for (const it of body.items) {
      const orderItem = itemMap.get(it.orderItemId);
      if (!orderItem) {
        return NextResponse.json({ error: `Order item ${it.orderItemId} not found in order` }, { status: 400 });
      }
      if (it.quantity <= 0 || it.quantity > orderItem.quantity) {
        return NextResponse.json(
          { error: `Invalid quantity for ${orderItem.title} (max ${orderItem.quantity})` },
          { status: 400 }
        );
      }
      if (it.refundAmount < 0) {
        return NextResponse.json({ error: 'Refund amount cannot be negative' }, { status: 400 });
      }
      totalRefund += it.refundAmount;
    }

    const rmaNumber = generateRmaNumber();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopOrderReturn.create({
      data: {
        rmaNumber,
        orderId: body.orderId,
        status: 'REQUESTED',
        reason: body.reason ?? 'OTHER',
        reasonNote: body.reasonNote ?? null,
        customerNote: body.customerNote ?? null,
        refundMethod: body.refundMethod ?? 'NONE',
        refundAmount: totalRefund,
        currency: order.currency,
        restockOnReceive: body.restockOnReceive ?? true,
        createdBy: session.email,
        items: {
          create: body.items.map((it) => {
            const orderItem = itemMap.get(it.orderItemId)!;
            return {
              orderItemId: it.orderItemId,
              productSlug: orderItem.productSlug,
              variantId: orderItem.variantId,
              title: orderItem.title,
              quantity: it.quantity,
              unitPrice: orderItem.price,
              refundAmount: it.refundAmount,
              reason: it.reason ?? null,
              conditionNote: it.conditionNote ?? null,
            };
          }),
        },
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'return.create',
      entityType: 'shop.return',
      entityId: created.id,
      metadata: { rmaNumber, orderId: body.orderId, totalRefund, itemCount: body.items.length },
    });

    return NextResponse.json({ id: created.id, rmaNumber });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Return create error:', error);
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }
}
