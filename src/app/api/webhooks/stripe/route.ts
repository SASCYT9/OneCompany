import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/shopStripe';
import { dispatchCrmWebhook } from '@/lib/webhookDispatcher';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe || !webhookSecret) {
    console.error('CRITICAL: Stripe or Webhook Secret is not configured.');
    return NextResponse.json({ error: 'Stripe configuration missing' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const orderNumber = session.metadata?.orderNumber;

    if (orderId && session.payment_status === 'paid') {
      console.log(`[Stripe Webhook] Order ${orderNumber} (${orderId}) successfully paid.`);

      try {
        const order = await prisma.shopOrder.findUnique({
          where: { id: orderId }
        });

        if (order) {
          // Update order to PAID and status to CONFIRMED
          await prisma.shopOrder.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'PAID',
              amountPaid: Number(order.total),
              status: order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_REVIEW' ? 'CONFIRMED' : order.status
            }
          });

          // Log event
          await prisma.shopOrderStatusEvent.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_REVIEW' ? 'CONFIRMED' : order.status,
              actorType: 'system',
              actorName: 'Stripe Webhook',
              note: `Payment completed via Stripe. Session ID: ${session.id}`
            }
          });

          // Optionally dispatch CRM webhook
          await dispatchCrmWebhook('order.paid', order).catch(() => {});
        }
      } catch (dbErr) {
        console.error(`[Stripe Webhook] DB update failed for order ${orderId}:`, dbErr);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
