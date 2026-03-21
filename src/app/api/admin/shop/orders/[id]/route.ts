import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { type OrderStatus } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { adminOrderInclude, canTransitionOrderStatus, serializeAdminOrder } from '@/lib/shopAdminOrders';
import { prisma } from '@/lib/prisma';

const ALLOWED_STATUSES: OrderStatus[] = ['PENDING_REVIEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const { id } = await params;
    const order = await prisma.shopOrder.findUnique({
      where: { id },
      include: adminOrderInclude,
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminOrder(order));
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((e as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop order get', e);
    return NextResponse.json({ error: 'Failed to get order' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = body.status as string | undefined;
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!status || !ALLOWED_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json({ error: 'Valid status required' }, { status: 400 });
    }
    const currentOrder = await prisma.shopOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!canTransitionOrderStatus(currentOrder.status, status as OrderStatus)) {
      return NextResponse.json({ error: `Invalid transition: ${currentOrder.status} -> ${status}` }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.shopOrder.update({
        where: { id },
        data: { status: status as OrderStatus },
      });

      if (currentOrder.status !== status) {
        await tx.shopOrderStatusEvent.create({
          data: {
            orderId: id,
            fromStatus: currentOrder.status,
            toStatus: status as OrderStatus,
            actorType: 'admin',
            actorName: session.name,
            note: note || null,
          },
        });
      }

      return updatedOrder;
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'order.status.update',
      entityType: 'shop.order',
      entityId: order.id,
      metadata: {
        fromStatus: currentOrder.status,
        toStatus: status,
        note: note || null,
      },
    });

    return NextResponse.json({ id: order.id, status: order.status });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((e as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop order update', e);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
