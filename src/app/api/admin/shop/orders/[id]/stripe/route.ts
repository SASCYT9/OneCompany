import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { createStripeCheckoutSession, stripeSupportedCurrency } from '@/lib/shopStripe';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;

    const order = await prisma.shopOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        currency: true,
        email: true,
        viewToken: true,
        paymentStatus: true,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus === 'PAID') return NextResponse.json({ error: 'Order already paid' }, { status: 400 });

    const supportedCurrency = stripeSupportedCurrency(order.currency);
    if (!supportedCurrency) {
      return NextResponse.json({ 
        error: `Stripe only supports EUR and USD for checkout. Order is in ${order.currency}. Please use Whitepay (Hutko) instead.` 
      }, { status: 400 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

    // Amount in cents
    const amountTotalCents = Math.round(Number(order.total) * 100);
    
    const successUrl = `${baseUrl}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}&payment=success&provider=stripe`;
    const cancelUrl = `${baseUrl}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;

    const stripeResult = await createStripeCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountTotalCents,
      currency: supportedCurrency,
      customerEmail: order.email,
      successUrl,
      cancelUrl,
      locale: 'en',
    });

    if ('error' in stripeResult) {
      return NextResponse.json({ error: stripeResult.error || 'Failed to generate Stripe link' }, { status: 502 });
    }

    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { 
        stripeCheckoutSessionId: stripeResult.sessionId,
        paymentMethod: 'STRIPE',
        status: 'PENDING_PAYMENT' 
      },
    });

    return NextResponse.json({ url: stripeResult.url, sessionId: stripeResult.sessionId });
  } catch (e) {
    console.error('Admin generate stripe link error', e);
    return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 });
  }
}
