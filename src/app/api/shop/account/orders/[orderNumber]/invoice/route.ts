/**
 * GET /api/shop/account/orders/[orderNumber]/invoice
 *
 * Streams a PDF invoice for the requested order. Auth required: customer can
 * only download invoices for orders that belong to their session (matched
 * either by `customerId` or by case-insensitive `email` for guest orders that
 * later linked to the account).
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { normalizeCustomerEmail } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';
import ShopOrderInvoicePdf from '@/emails/ShopOrderInvoicePdf';

type RouteContext = { params: Promise<{ orderNumber: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const { orderNumber } = await context.params;

    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyName: true,
        vatNumber: true,
        preferredLocale: true,
      },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const order = await prisma.shopOrder.findFirst({
      where: {
        orderNumber,
        OR: [
          { customerId: session.customerId },
          {
            customerId: null,
            email: { equals: normalizeCustomerEmail(customer.email), mode: 'insensitive' },
          },
        ],
      },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const shipping =
      order.shippingAddress && typeof order.shippingAddress === 'object'
        ? (order.shippingAddress as Record<string, unknown> as {
            name?: string | null;
            line1?: string | null;
            line2?: string | null;
            city?: string | null;
            region?: string | null;
            postcode?: string | null;
            country?: string | null;
            phone?: string | null;
          })
        : null;

    const locale: 'ua' | 'en' = customer.preferredLocale === 'ua' ? 'ua' : 'en';
    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();

    const pdfBuffer = await renderToBuffer(
      ShopOrderInvoicePdf({
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        currency: order.currency,
        subtotal: Number(order.subtotal),
        shippingCost: Number(order.shippingCost),
        taxAmount: Number(order.taxAmount),
        total: Number(order.total),
        items: order.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: Number(item.price),
          total: Number(item.total),
        })),
        customer: {
          fullName: fullName || customer.email,
          email: customer.email,
          phone: customer.phone,
          companyName: customer.companyName,
          vatNumber: customer.vatNumber,
        },
        shipping,
        locale,
      }),
    );

    const fileName = `invoice-${order.orderNumber}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop invoice generation', error);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
