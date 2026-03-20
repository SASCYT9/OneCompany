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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data, errors } = normalizeAdminShipmentPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const existing = await prisma.shopShipment.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        status: true,
        trackingNumber: true,
        order: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const shipment = await tx.shopShipment.update({
        where: { id },
        data: {
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
        orderId: existing.orderId,
        currentOrderStatus: existing.order.status,
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
      action: 'shipment.update',
      entityType: 'shop.shipment',
      entityId: result.shipment.id,
      metadata: {
        orderId: existing.orderId,
        fromStatus: existing.status,
        toStatus: result.shipment.status,
        trackingNumber: result.shipment.trackingNumber,
        previousTrackingNumber: existing.trackingNumber,
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
    console.error('Admin shipment update', error);
    return NextResponse.json({ error: 'Failed to update shipment' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;

    const shipment = await prisma.shopShipment.delete({
      where: { id },
      select: {
        id: true,
        orderId: true,
        trackingNumber: true,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'shipment.delete',
      entityType: 'shop.shipment',
      entityId: shipment.id,
      metadata: {
        orderId: shipment.orderId,
        trackingNumber: shipment.trackingNumber,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shipment delete', error);
    return NextResponse.json({ error: 'Failed to delete shipment' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
