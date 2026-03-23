import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { generateOrderNumber, generateViewToken } from '@/lib/shopOrder';
import { dispatchCrmWebhook } from '@/lib/webhookDispatcher';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE || 'ADMIN_ALL');

    const data = await request.json();
    const { customerEmail, items, currency, deliveryMethod, shippingCost } = data;

    if (!customerEmail || !items || !items.length) {
      return NextResponse.json({ error: 'Missing customer email or items' }, { status: 400 });
    }

    const customer = await prisma.shopCustomer.findUnique({
      where: { email: customerEmail }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    let subtotal = 0;
    const orderItems = items.map((i: any) => {
      const price = parseFloat(i.price) || 0;
      const quantity = parseInt(i.quantity, 10) || 1;
      const total = price * quantity;
      subtotal += total;
      
      return {
        productSlug: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: i.title || 'Draft Item',
        quantity,
        price,
        total,
      };
    });

    const parsedShippingCost = parseFloat(shippingCost) || 0;
    const finalTotal = subtotal + parsedShippingCost;

    const orderNumber = await generateOrderNumber();
    const viewToken = generateViewToken();

    const orderData = {
      orderNumber,
      status: 'PENDING_PAYMENT' as const,
      paymentMethod: 'FOP',
      customerId: customer.id,
      customerGroupSnapshot: customer.group,
      email: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      shippingAddress: {},
      deliveryMethod: deliveryMethod || 'SPECIAL_DELIVERY',
      shippingCalculatedCost: parsedShippingCost,
      currency: currency || 'EUR',
      subtotal,
      shippingCost: parsedShippingCost,
      taxAmount: 0,
      total: finalTotal,
      pricingSnapshot: { adminDraft: true },
      viewToken,
      items: {
        create: orderItems
      }
    };

    const order = await prisma.shopOrder.create({
      data: orderData
    });

    await dispatchCrmWebhook('order.created', order).catch(() => {});

    return NextResponse.json({ success: true, orderId: order.id, orderNumber });

  } catch (error: any) {
    console.error('Draft Order Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process Draft Order' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
