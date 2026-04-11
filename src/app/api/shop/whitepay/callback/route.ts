import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Whitepay Webhook Handler
 * 
 * Docs: https://docs.whitepay.com/9zfKPu1hqeaacleEeek3/webhooks/
 * 
 * Webhook events for orders:
 *   - order::completed       → PAID
 *   - order::declined        → UNPAID
 *   - order::partially_fulfilled → PARTIALLY_PAID
 *   - order::final_amount_was_received → (confirmation, no status change needed)
 * 
 * Signature validation:
 *   Header "Signature" = HMAC-SHA256(JSON.stringify(body).replace(/\//g, "\\/"), secret)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    
    console.log('[Whitepay Webhook] Received webhook, body length:', rawBody.length);

    // Validate signature if WHITEPAY_WEBHOOK_TOKEN is set
    const webhookSecret = process.env.WHITEPAY_WEBHOOK_TOKEN;
    if (webhookSecret) {
      const receivedSignature = req.headers.get('signature') || req.headers.get('Signature') || '';
      
      // Whitepay signs the JSON body with forward slashes escaped (\/)
      // as per their docs: JSON.stringify(payload).replace(/\//g, "\\/")
      const bodyForSigning = rawBody.replace(/\//g, '\\/');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyForSigning)
        .digest('hex');
      
      if (receivedSignature !== expectedSignature) {
        console.warn('[Whitepay Webhook] Signature mismatch!', {
          received: receivedSignature.substring(0, 16) + '...',
          expected: expectedSignature.substring(0, 16) + '...',
        });
        return new Response('Invalid signature', { status: 401 });
      }
      console.log('[Whitepay Webhook] Signature validated ✓');
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[Whitepay Webhook] Invalid JSON body');
      return new Response('Invalid JSON', { status: 400 });
    }

    const eventType = body.event_type;
    console.log('[Whitepay Webhook] Event type:', eventType);

    // Handle order events
    const orderData = body.order;
    if (!orderData) {
      // Could be a transaction event — log and acknowledge
      console.log('[Whitepay Webhook] Non-order event, acknowledging:', eventType);
      return NextResponse.json({ received: true, event: eventType });
    }

    // Extract order number — we use orderNumber as external_order_id
    // Admin routes append _timestamp for uniqueness, so strip that
    const rawExternalId = String(orderData.external_order_id || '');
    const orderNumber = rawExternalId.split('_')[0];

    if (!orderNumber) {
      console.warn('[Whitepay Webhook] No external_order_id in webhook');
      return NextResponse.json({ received: true, ignored: true, reason: 'No external_order_id' });
    }

    console.log('[Whitepay Webhook] Processing order:', orderNumber, '| Whitepay status:', orderData.status, '| Event:', eventType);

    const order = await prisma.shopOrder.findUnique({
      where: { orderNumber: String(orderNumber) },
      select: { id: true, total: true, paymentStatus: true, status: true }
    });

    if (!order) {
      console.warn('[Whitepay Webhook] Order not found in DB:', orderNumber);
      return NextResponse.json({ received: true, ignored: true, reason: 'Order not found' });
    }

    // Map Whitepay event_type to our payment status
    let newPaymentStatus = order.paymentStatus;
    let newOrderStatus = order.status;
    let newAmountPaid: number | undefined = undefined;

    switch (eventType) {
      case 'order::completed':
      case 'order::final_amount_was_received':
        newPaymentStatus = 'PAID';
        newAmountPaid = Number(order.total);
        newOrderStatus = 'CONFIRMED';
        break;
      case 'order::partially_fulfilled':
        newPaymentStatus = 'PARTIALLY_PAID';
        break;
      case 'order::declined':
        // Don't revert if already paid
        if (order.paymentStatus !== 'PAID') {
          newPaymentStatus = 'UNPAID';
          newOrderStatus = 'CANCELLED';
        }
        break;
      default:
        console.log('[Whitepay Webhook] Unhandled event type:', eventType);
        return NextResponse.json({ received: true, event: eventType, action: 'none' });
    }

    if (newPaymentStatus !== order.paymentStatus || newOrderStatus !== order.status) {
      await prisma.shopOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          status: newOrderStatus,
          ...(newAmountPaid !== undefined ? { amountPaid: newAmountPaid } : {}),
        }
      });
      console.log(`[Whitepay Webhook] ✅ Order ${orderNumber} updated: payment=${newPaymentStatus}, status=${newOrderStatus}`);
    } else {
      console.log(`[Whitepay Webhook] No status change needed for order ${orderNumber}`);
    }

    return NextResponse.json({ received: true, status: 'processed', orderNumber });
  } catch (err: any) {
    console.error('[Whitepay Webhook Error]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
