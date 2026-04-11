import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { createHutkoCheckout } from '@/lib/shopHutko';

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

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

    // Hutko amount: integer in smallest currency unit (kopecks/cents)
    const amountKopecks = String(Math.round(Number(order.total) * 100));
    
    // Use the actual view checkout link as the response URL after payment
    const responseUrl = `${baseUrl}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;

    const hutkoResult = await createHutkoCheckout({
      orderId: `${order.orderNumber}_${Date.now()}`, // unique per generation
      orderDescription: `One Company #${order.orderNumber}`,
      amount: amountKopecks,
      currency: order.currency as 'UAH' | 'USD' | 'EUR',
      responseUrl,
      serverCallbackUrl: `${baseUrl}/api/shop/hutko/callback`,
      senderEmail: order.email,
      lang: 'uk', // Usually uk for sending links
    });

    if (!hutkoResult.success) {
      return NextResponse.json({ error: hutkoResult.error || 'Failed to generate link' }, { status: 502 });
    }

    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { 
        hutkoPaymentId: hutkoResult.paymentId || null,
        paymentMethod: 'HUTKO',
        status: 'PENDING_PAYMENT' 
      },
    });

    return NextResponse.json({ url: hutkoResult.checkoutUrl, paymentId: hutkoResult.paymentId });
  } catch (e) {
    console.error('Admin generate hutko link error', e);
    return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 });
  }
}
