/**
 * POST /api/shop/stripe/webhook
 * Stripe webhook: checkout.session.completed → mark order CONFIRMED, send confirmation email and notify admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import OrderConfirmationEmail from '@/components/emails/OrderConfirmationEmail';
import { notifyAdminNewShopOrder } from '@/lib/telegramNotifications';
import { getStripeClient } from '@/lib/shopStripe';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let payload: string;
  try {
    payload = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('Stripe webhook: checkout.session.completed without metadata.orderId');
    return NextResponse.json({ received: true });
  }

  const order = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ received: true });
  }

  await prisma.$transaction([
    prisma.shopOrder.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
    }),
    prisma.shopOrderStatusEvent.create({
      data: {
        orderId,
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'CONFIRMED',
        actorType: 'system',
        actorName: 'Stripe',
        note: 'Payment completed',
      },
    }),
  ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');
  const locale = 'ua'; // or derive from order/customer
  const viewOrderUrl = `${baseUrl}/${locale}/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
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
          locale: locale as 'ua' | 'en',
          viewOrderUrl,
          items: order.items.map((i) => ({
            title: i.title,
            quantity: i.quantity,
            total: Number(i.total),
          })),
        })
      );
      await resend.emails.send({
        from: `One Company Shop <${process.env.EMAIL_FROM}>`,
        to: [order.email],
        subject: locale === 'ua' ? `Замовлення ${order.orderNumber} оплачено` : `Order ${order.orderNumber} paid`,
        html: emailHtml,
      });
    } catch (err) {
      console.error('Stripe webhook: order confirmation email failed', err);
    }
  }

  try {
    await notifyAdminNewShopOrder({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: order.email,
      currency: order.currency,
      total: Number(order.total),
      itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (err) {
    console.error('Stripe webhook: admin notification failed', err);
  }

  return NextResponse.json({ received: true });
}
