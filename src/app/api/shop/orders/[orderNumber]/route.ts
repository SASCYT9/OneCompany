import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { prisma } from '@/lib/prisma';

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

  const itemsList = order.items.map((i) => {
    let sku: string | null = null;
    let brand: string | null = null;
    const snap = order.pricingSnapshot as any;
    let pricingSource: string | null = null;
    let discountPercent: number | null = null;
    let originalPrice: number | null = null;

    if (snap?.source === 'turn14_catalog') {
      sku = snap.partNumber || null;
      brand = snap.brandName || null;
    } else if (snap?.items) {
      const d = (snap.items as any[]).find((item) => item.slug === i.productSlug);
      if (d?.slug?.startsWith('turn14-')) {
        sku = d.slug.replace('turn14-', '');
        const brandMatch = i.title.match(/\((.*?)\)$/);
        if (brandMatch) brand = brandMatch[1];
      }
      if (d) {
        pricingSource = d.pricingSource || null;
        discountPercent = d.discountPercent || null;
        originalPrice = d.originalPrice || d.unitPrice || null;
      }
    }

    if (!sku && i.productSlug?.startsWith('turn14-')) {
      sku = i.productSlug.replace('turn14-', '');
      const brandMatch = i.title.match(/\((.*?)\)$/);
      if (brandMatch) brand = brandMatch[1];
    }
    
    if (!sku && i.productSlug?.startsWith('crm-')) {
      sku = i.productSlug.replace('crm-', '');
    }

    return {
      productSlug: i.productSlug,
      title: i.title,
      quantity: i.quantity,
      price: Number(i.price),
      originalPrice,
      pricingSource,
      discountPercent,
      total: Number(i.total),
      image: i.image,
      sku,
      brand,
    };
  });

  for (const item of itemsList) {
    if (!item.image && item.sku) {
      const t14 = await prisma.turn14Item.findFirst({ where: { partNumber: item.sku } });
      if (t14?.thumbnail) item.image = t14.thumbnail;
    }
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod ?? 'FOP',
    email: order.email,
    customerName: order.customerName,
    phone: order.phone,
    shippingAddress: order.shippingAddress as object,
    currency: order.currency,
    customerGroupSnapshot: order.customerGroupSnapshot,
    subtotal: Number(order.subtotal),
    regionalAdjustmentAmount: Number(((order.pricingSnapshot as Record<string, unknown> | null)?.regionalAdjustmentAmount as number | undefined) ?? 0),
    shippingCost: Number(order.shippingCost),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
    pricingSnapshot: order.pricingSnapshot,
    regionalPricingRule: ((order.pricingSnapshot as Record<string, unknown> | null)?.regionalPricingRule as object | undefined) ?? null,
    showTaxesIncludedNotice: Boolean((order.pricingSnapshot as Record<string, unknown> | null)?.showTaxesIncludedNotice),
    createdAt: order.createdAt.toISOString(),
    items: itemsList,
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
