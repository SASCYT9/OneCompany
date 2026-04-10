import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Optionally check Authorization header here if Whitepay uses Bearer
    const authHeader = req.headers.get('authorization');
    if (process.env.WHITEPAY_WEBHOOK_TOKEN && authHeader !== `Bearer ${process.env.WHITEPAY_WEBHOOK_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();

    // Whitepay webhook payload usually looks like: { order: { external_order_id, status, ... } }
    const orderData = body.order;
    if (!orderData) {
      return NextResponse.json({ received: true, ignored: true, reason: 'No order in body' });
    }

    const orderNumber = orderData.external_order_id;
    const status = orderData.status;

    if (!orderNumber || !status) {
       return NextResponse.json({ received: true, ignored: true, reason: 'Missing order_number or status' });
    }

    const order = await prisma.shopOrder.findUnique({
      where: { orderNumber: String(orderNumber) },
      select: { id: true, total: true, paymentStatus: true }
    });

    if (!order) {
      return NextResponse.json({ received: true, ignored: true, reason: 'Order not found in DB' });
    }

    // Map Whitepay status to our payment status
    // Whitepay statuses: COMPLETED, CANCELED, EXPIRED_BY_TIME, DECLINED, PARTIAL_AMOUNT etc.
    let newPaymentStatus = order.paymentStatus;
    let newAmountPaid = undefined;

    if (status === 'COMPLETED' || status === 'SUCCESS') {
      newPaymentStatus = 'PAID';
      newAmountPaid = Number(order.total);
    } else if (status === 'PARTIAL_AMOUNT') {
      newPaymentStatus = 'PARTIALLY_PAID';
    } else if (status === 'DECLINED' || status === 'CANCELED' || status === 'EXPIRED_BY_TIME') {
      // If it was already paid, don't revert unless manual action
      if (order.paymentStatus !== 'PAID') {
        newPaymentStatus = 'UNPAID';
      }
    }

    if (newPaymentStatus !== order.paymentStatus) {
      await prisma.shopOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          ...(newAmountPaid !== undefined ? { amountPaid: newAmountPaid } : {})
        }
      });
      console.log(`[Whitepay Webhook] Order ${orderNumber} updated to ${newPaymentStatus}`);
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (err: any) {
    console.error('[Whitepay Webhook Error]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
