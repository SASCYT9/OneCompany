/**
 * POST /api/shop/hutko/callback
 * 
 * Hutko sends payment result here (server_callback_url).
 * Verifies signature, updates order status, sends confirmation email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { verifyHutkoSignature } from '@/lib/shopHutko';
import { prisma } from '@/lib/prisma';
import OrderConfirmationEmail from '@/components/emails/OrderConfirmationEmail';
import { notifyAdminNewShopOrder } from '@/lib/telegramNotifications';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export async function POST(req: NextRequest) {
  let body: Record<string, string>;

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await req.json();
    body = json.response || json;
  } else {
    // x-www-form-urlencoded
    const formData = await req.formData();
    body = {} as Record<string, string>;
    formData.forEach((value, key) => {
      body[key] = String(value);
    });
  }

  console.log('[Hutko Callback] Received:', JSON.stringify(body));

  // Verify signature
  if (!verifyHutkoSignature(body)) {
    console.error('[Hutko Callback] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const rawOrderId = String(body.order_id || '');
  const orderId = rawOrderId.split('_')[0]; // Extract base orderNumber
  const orderStatus = body.order_status; // approved, declined, expired, processing, etc.
  const paymentId = body.payment_id;

  if (!orderId) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  // Find order by orderNumber (we use orderNumber as hutko order_id)
  const order = await prisma.shopOrder.findFirst({
    where: { orderNumber: orderId },
    include: { items: true },
  });

  if (!order) {
    console.error('[Hutko Callback] Order not found:', orderId);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Already processed (CONFIRMED or later stages)
  if (['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
    return NextResponse.json({ status: 'already_processed' });
  }

  if (orderStatus === 'approved') {
    // Payment successful — mark as CONFIRMED
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        hutkoPaymentId: paymentId || null,
      },
    });

    // Send confirmation email
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM && order.email) {
      try {
        const locale = 'ua'; // Hutko is UA-only payment
        const viewOrderUrl = `${baseUrl}/${locale}/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;

        const emailHtml = await render(
          OrderConfirmationEmail({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            email: order.email,
            currency: order.currency,
            subtotal: Number(order.subtotal),
            shippingCost: Number(order.shippingCost),
            taxAmount: Number(order.taxAmount),
            total: Number(order.total),
            locale,
            viewOrderUrl,
            items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, total: Number(i.total) })),
          })
        );

        await resend.emails.send({
          from: `One Company Shop <${process.env.EMAIL_FROM}>`,
          to: [order.email],
          subject: `Замовлення ${order.orderNumber} оплачено ✓`,
          html: emailHtml,
        });
      } catch (err) {
        console.error('[Hutko Callback] Email failed:', err);
      }
    }

    // Telegram notification
    try {
      await notifyAdminNewShopOrder({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        email: order.email || '',
        currency: order.currency,
        total: Number(order.total),
        itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      });
    } catch (err) {
      console.error('[Hutko Callback] Telegram failed:', err);
    }

    console.log(`[Hutko Callback] Order ${orderId} approved, paymentId: ${paymentId}`);
  } else if (orderStatus === 'declined' || orderStatus === 'expired') {
    await prisma.shopOrder.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        hutkoPaymentId: paymentId || null,
      },
    });

    console.log(`[Hutko Callback] Order ${orderId} ${orderStatus}`);
  } else {
    // processing or other status — just log
    console.log(`[Hutko Callback] Order ${orderId} status: ${orderStatus}`);
  }

  return NextResponse.json({ status: 'ok' });
}

export const runtime = 'nodejs';
