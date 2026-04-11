import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { createWhitepayCryptoOrder, isWhitepayEnabled } from '@/lib/shopWhitepay';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;

    if (!isWhitepayEnabled()) {
       return NextResponse.json({ error: 'Whitepay Token is not configured.' }, { status: 500 });
    }

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

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

    // Amount as float string e.g. "100.50"
    const amountStr = Number(order.total).toFixed(2);
    
    // Use the actual view checkout link as the response URL after payment
    const successUrl = `${baseUrl}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;
    const failUrl = `${baseUrl}/ua/shop/checkout/error`;
    const webhookUrl = `${baseUrl}/api/shop/whitepay/callback`;

    const whitepayResult = await createWhitepayCryptoOrder({
      amount: amountStr,
      currency: order.currency, // Whitepay uses this to calculate crypto equivalents
      external_order_id: `${order.orderNumber}_${Date.now()}`, // unique per generation
      success_url: successUrl,
      fail_url: failUrl,
      webhooks: [webhookUrl]
    });

    if (!whitepayResult.success) {
      console.error('[Whitepay Crypto API error]', whitepayResult);
      return NextResponse.json({ error: whitepayResult.error || 'Failed to generate link' }, { status: 502 });
    }

    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { 
        paymentMethod: 'WHITEPAY_CRYPTO',
        status: 'PENDING_PAYMENT' 
      },
    });

    return NextResponse.json({ url: whitepayResult.url, paymentId: whitepayResult.orderId });
  } catch (e: any) {
    console.error('Admin generate whitepay crypto link error', e);
    return NextResponse.json({ error: e.message || 'Failed to generate payment link' }, { status: 500 });
  }
}
