import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PrismaClient, type OrderStatus } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminOrderInclude,
  ALL_ORDER_STATUSES,
  canTransitionOrderStatus,
  serializeAdminOrderSummary,
} from '@/lib/shopAdminOrders';

const prisma = new PrismaClient();

type SerializedOrderSummary = ReturnType<typeof serializeAdminOrderSummary>;

function buildCountMap(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildNamedCountMap(entries: Array<{ id: string | null; name: string | null }>) {
  return entries.reduce<Record<string, { label: string; count: number }>>((acc, entry) => {
    if (!entry.id) return acc;
    const current = acc[entry.id];
    acc[entry.id] = {
      label: entry.name || entry.id,
      count: current ? current.count + 1 : 1,
    };
    return acc;
  }, {});
}

function buildFilters(orders: SerializedOrderSummary[]) {
  const currencies = buildCountMap(orders.map((order) => order.currency));
  const shippingZones = buildNamedCountMap(
    orders.map((order) => ({
      id: order.shippingZoneId,
      name: order.shippingZoneName,
    }))
  );
  const taxRegions = buildNamedCountMap(
    orders.map((order) => ({
      id: order.taxRegionId,
      name: order.taxRegionName,
    }))
  );

  return {
    currencies: Object.entries(currencies)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => ({ value, label: value, count })),
    shippingZones: Object.entries(shippingZones)
      .sort(([, left], [, right]) => left.label.localeCompare(right.label))
      .map(([value, entry]) => ({ value, label: entry.label, count: entry.count })),
    taxRegions: Object.entries(taxRegions)
      .sort(([, left], [, right]) => left.label.localeCompare(right.label))
      .map(([value, entry]) => ({ value, label: entry.label, count: entry.count })),
  };
}

function buildStats(orders: SerializedOrderSummary[]) {
  return {
    total: orders.length,
    statusCounts: ALL_ORDER_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = orders.filter((order) => order.status === status).length;
      return acc;
    }, {}),
    currencyCounts: buildCountMap(orders.map((order) => order.currency)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const status = request.nextUrl.searchParams.get('status')?.trim().toUpperCase() || '';
    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    const currency = request.nextUrl.searchParams.get('currency')?.trim().toUpperCase() || '';
    const shippingZone = request.nextUrl.searchParams.get('shippingZone')?.trim() || '';
    const taxRegion = request.nextUrl.searchParams.get('taxRegion')?.trim() || '';
    const where: Prisma.ShopOrderWhereInput = {
      ...(status ? { status: status as Prisma.ShopOrderWhereInput['status'] } : {}),
      ...(query
        ? {
            OR: [
              { orderNumber: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { customerName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orders = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: adminOrderInclude,
    });
    const serialized = orders.map(serializeAdminOrderSummary);
    const filtered = serialized.filter((order) => {
      if (currency && order.currency.toUpperCase() !== currency) return false;
      if (shippingZone && order.shippingZoneId !== shippingZone) return false;
      if (taxRegion && order.taxRegionId !== taxRegion) return false;
      return true;
    });

    return NextResponse.json({
      orders: filtered,
      stats: buildStats(filtered),
      filters: buildFilters(serialized),
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((e as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop orders list', e);
    return NextResponse.json({ error: 'Failed to list orders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const body = await request.json().catch(() => ({}));
    const rawOrderIds: unknown[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    const orderIds: string[] = Array.from(
      new Set(rawOrderIds.map((value: unknown) => String(value ?? '').trim()).filter(Boolean))
    );
    const status = String(body.status ?? '').trim().toUpperCase() as OrderStatus;
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!orderIds.length) {
      return NextResponse.json({ error: 'At least one order is required' }, { status: 400 });
    }

    if (!ALL_ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Valid status required' }, { status: 400 });
    }

    const orders = await prisma.shopOrder.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    });

    const missingOrderIds = orderIds.filter((orderId) => !orders.some((order) => order.id === orderId));
    if (missingOrderIds.length) {
      return NextResponse.json(
        { error: 'Some orders were not found', missingOrderIds },
        { status: 404 }
      );
    }

    const invalidOrders = orders.filter((order) => !canTransitionOrderStatus(order.status, status));
    if (invalidOrders.length) {
      return NextResponse.json(
        {
          error: 'One or more orders cannot move to the requested status',
          invalidOrders: invalidOrders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            fromStatus: order.status,
            toStatus: status,
          })),
        },
        { status: 400 }
      );
    }

    const changedOrders = orders.filter((order) => order.status !== status);

    await prisma.$transaction(async (tx) => {
      for (const order of changedOrders) {
        await tx.shopOrder.update({
          where: { id: order.id },
          data: { status },
        });
        await tx.shopOrderStatusEvent.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: status,
            actorType: 'admin',
            actorName: session.name,
            note: note || null,
          },
        });
      }
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'order.bulk-status.update',
      entityType: 'shop.order',
      metadata: {
        orderIds,
        changedOrderIds: changedOrders.map((order) => order.id),
        toStatus: status,
        note: note || null,
      },
    });

    return NextResponse.json({
      updatedCount: changedOrders.length,
      skippedCount: orders.length - changedOrders.length,
      status,
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((e as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop orders bulk update', e);
    return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
  }
}
