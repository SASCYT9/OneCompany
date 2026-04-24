import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber, generateViewToken } from '@/lib/shopOrder';

/**
 * POST /api/admin/shop/orders/create
 *
 * Admin-created order with full shipping + pricing breakdown.
 * Every field is passed from the admin UI and stored in pricingSnapshot.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const body = await request.json();
    const {
      customerId,
      currency = 'USD',
      zone = 'KZ',
      shippingCost = 0,
      subtotal = 0,
      total = 0,
      notes = '',
      shippingCalc = {},
      items = [],
    } = body;

    // Validate
    if (!customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Load customer
    const customer = await prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        group: true,
        b2bDiscountPercent: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const orderNumber = await generateOrderNumber();
    const viewToken = generateViewToken();

    // Create order
    const order = await prisma.shopOrder.create({
      data: {
        orderNumber,
        status: 'PENDING_REVIEW',
        paymentStatus: 'UNPAID',
        paymentMethod: 'FOP',
        customerId: customer.id,
        customerGroupSnapshot: customer.group,
        email: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: customer.phone,
        shippingAddress: { country: zone },
        currency,
        subtotal: parseFloat(String(subtotal)) || 0,
        shippingCost: parseFloat(String(shippingCost)) || 0,
        shippingCalculatedCost: shippingCalc.autoShippingTotal ?? null,
        taxAmount: 0,
        total: parseFloat(String(total)) || 0,
        viewToken,
        deliveryMethod: 'SPECIAL_DELIVERY',
        pricingSnapshot: {
          source: 'admin_manual',
          zone,
          shippingCalc,
          customerDiscount: customer.b2bDiscountPercent ? Number(customer.b2bDiscountPercent) : 0,
          notes,
          itemDetails: items.map((item: any) => ({
            entryMode: item.entryMode,
            sourceType: item.sourceType,
            title: item.title,
            partNumber: item.partNumber,
            brand: item.brand,
            baseCostUsd: item.baseCostUsd,
            markupPct: item.markupPct,
            discountPct: item.discountPct,
            unitPrice: item.unitPrice,
            weightKg: item.weightKg,
            turn14Id: item.turn14Id,
          })),
        },
        items: {
          create: items.map((item: any) => ({
            productSlug: `admin-${item.partNumber || Date.now()}-${Math.random().toString(36).substring(7)}`,
            title: `${item.title}${item.brand ? ` (${item.brand})` : ''}`,
            quantity: parseInt(String(item.quantity), 10) || 1,
            price: parseFloat(String(item.unitPrice)) || 0,
            total: parseFloat(String(item.lineTotal)) || 0,
            image: item.thumbnail || null,
          })),
        },
      },
      include: { items: true },
    });

    // Audit log
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'order.admin_create',
      entityType: 'shop.order',
      entityId: order.id,
      metadata: {
        orderNumber,
        customerId: customer.id,
        customerEmail: customer.email,
        total: order.total,
        currency,
        zone,
        itemCount: items.length,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[Admin Create Order]', error);
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
