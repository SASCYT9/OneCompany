/**
 * GET /api/shop/orders/[orderNumber]?token=xxx
 * Returns order for guest confirmation view. Token required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const token = req.nextUrl.searchParams.get('token');
  const session = await getCurrentShopCustomerSession();

  const order = await prisma.shopOrder.findFirst({
    where: token?.trim()
      ? { orderNumber, viewToken: token }
      : session?.customerId
        ? { orderNumber, customerId: session.customerId }
        : { orderNumber: '__missing__' },
    include: {
      items: true,
      shipments: {
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  });

  if (!order) {
    if (!token?.trim() && !session?.customerId) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    email: order.email,
    customerName: order.customerName,
    phone: order.phone,
    shippingAddress: order.shippingAddress as object,
    currency: order.currency,
    customerGroupSnapshot: order.customerGroupSnapshot,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
    pricingSnapshot: order.pricingSnapshot,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      productSlug: i.productSlug,
      title: i.title,
      quantity: i.quantity,
      price: Number(i.price),
      total: Number(i.total),
      image: i.image,
    })),
    shipments: order.shipments.map((shipment) => ({
      id: shipment.id,
      carrier: shipment.carrier,
      serviceLevel: shipment.serviceLevel,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      status: shipment.status,
      shippedAt: shipment.shippedAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    })),
  });
}
