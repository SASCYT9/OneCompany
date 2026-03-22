import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/shop/turn14/order
 * 
 * Creates an order directly from a Turn14 catalog item.
 * Since Turn14 items are live (not stored locally), this bypasses the cart
 * and creates a ShopOrder directly with Turn14 metadata.
 * 
 * Body: { item, customerEmail?, customerName?, customerPhone?, quantity }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item, customerEmail, customerName, customerPhone, quantity = 1 } = body;

    if (!item || !item.name) {
      return NextResponse.json({ error: 'Item data is required' }, { status: 400 });
    }

    // Generate a unique order number
    const orderCount = await prisma.shopOrder.count();
    const orderNumber = `T14-${String(orderCount + 1001).padStart(5, '0')}`;

    // Price calculation
    const unitPrice = item.price || 0;
    const subtotal = unitPrice * quantity;

    // Try to find or create customer
    let customerId: string | null = null;
    if (customerEmail) {
      const existing = await prisma.shopCustomer.findUnique({
        where: { email: customerEmail },
      });
      if (existing) {
        customerId = existing.id;
      } else {
        const newCustomer = await prisma.shopCustomer.create({
          data: {
            email: customerEmail,
            firstName: customerName?.split(' ')[0] || '',
            lastName: customerName?.split(' ').slice(1).join(' ') || '',
            phone: customerPhone || null,
            group: 'B2C',
            isActive: true,
            preferredLocale: 'ua',
          },
        });
        customerId = newCustomer.id;
      }
    }

    // Create the order
    const order = await prisma.shopOrder.create({
      data: {
        orderNumber,
        email: customerEmail || 'guest@onecompany.local',
        customerName: customerName || 'Гість',
        customerId,
        status: 'PENDING_REVIEW',
        paymentStatus: 'UNPAID',
        currency: 'USD',
        subtotal,
        shippingCost: 0,
        taxAmount: 0,
        total: subtotal,
        amountPaid: 0,
        shippingAddress: {
          line1: '',
          city: '',
          country: '',
          phone: customerPhone || '',
        },
        viewToken: crypto.randomUUID(),
        pricingSnapshot: {
          source: 'turn14_catalog',
          turn14Id: item.turn14Id || item.id,
          partNumber: item.partNumber,
          brandName: item.brand,
          itemName: item.name,
          basePrice: item.basePrice,
          markupPct: item.markupPct,
          finalPrice: unitPrice,
          quantity,
        },
        items: {
          create: {
            productSlug: `turn14-${item.partNumber || item.id}`,
            title: `${item.name} (${item.brand || 'Turn14'})`,
            quantity,
            price: unitPrice,
            total: subtotal,
            image: item.thumbnail || null,
          },
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: subtotal,
      message: `Замовлення ${order.orderNumber} створено!`,
    });
  } catch (error: any) {
    console.error('[Turn14 Order Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
