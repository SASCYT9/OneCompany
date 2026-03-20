import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminShipmentSelect,
  maybeApplyShipmentOrderStatus,
  normalizeAdminShipmentPayload,
  serializeAdminShipment,
} from '@/lib/shopAdminShipments';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const { data, errors } = normalizeAdminShipmentPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const order = await prisma.shopOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shopShipment.create({
        data: {
          orderId,
          carrier: data.carrier,
          serviceLevel: data.serviceLevel,
          trackingNumber: data.trackingNumber,
          trackingUrl: data.trackingUrl,
          status: data.status,
          notes: data.notes,
          shippedAt:
            data.shippedAt
              ? new Date(data.shippedAt)
              : data.status === 'IN_TRANSIT'
                ? new Date()
                : null,
          deliveredAt:
            data.deliveredAt
              ? new Date(data.deliveredAt)
              : data.status === 'DELIVERED'
                ? new Date()
                : null,
        },
        select: adminShipmentSelect,
      });

      const orderStatus = await maybeApplyShipmentOrderStatus(tx, {
        orderId,
        currentOrderStatus: order.status,
        shipmentStatus: shipment.status,
        actorName: session.name,
      });

      return {
        shipment,
        orderStatus,
      };
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'shipment.create',
      entityType: 'shop.shipment',
      entityId: result.shipment.id,
      metadata: {
        orderId,
        trackingNumber: result.shipment.trackingNumber,
        status: result.shipment.status,
        orderStatus: result.orderStatus,
      },
    });

    return NextResponse.json(serializeAdminShipment(result.shipment));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shipment create', error);
    return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
