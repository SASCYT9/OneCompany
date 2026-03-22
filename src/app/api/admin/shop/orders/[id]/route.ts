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

    const updateData: any = {};
    if (status) {
      if (!ALLOWED_STATUSES.includes(status as OrderStatus)) return NextResponse.json({ error: 'Valid status required' }, { status: 400 });
      updateData.status = status as OrderStatus;
    }

    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.amountPaid !== undefined) updateData.amountPaid = Number(body.amountPaid);
    if (body.deliveryMethod !== undefined) updateData.deliveryMethod = body.deliveryMethod || null;
    if (body.ttnNumber !== undefined) updateData.ttnNumber = body.ttnNumber || null;
    if (body.shippingCalculatedCost !== undefined) updateData.shippingCalculatedCost = body.shippingCalculatedCost ? Number(body.shippingCalculatedCost) : null;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }
    const currentOrder = await prisma.shopOrder.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (updateData.status && !canTransitionOrderStatus(currentOrder.status, updateData.status as OrderStatus)) {
      return NextResponse.json({ error: `Invalid transition: ${currentOrder.status} -> ${updateData.status}` }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.shopOrder.update({
        where: { id },
        data: updateData,
      });

      if (updateData.status && currentOrder.status !== updateData.status) {
        await tx.shopOrderStatusEvent.create({
          data: {
            orderId: id,
            fromStatus: currentOrder.status,
            toStatus: updateData.status as OrderStatus,
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
        toStatus: updateData.status || currentOrder.status,
        note: note || null,
        updates: updateData,
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
