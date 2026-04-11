import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    
    console.log('[Shopify Whitepay Callback] Received webhook');

    // 1. Signature Validation (same as regular shop callback)
    const webhookSecret = process.env.WHITEPAY_WEBHOOK_TOKEN;
    if (webhookSecret) {
      const receivedSignature = req.headers.get('signature') || req.headers.get('Signature') || '';
      const bodyForSigning = rawBody.replace(/\//g, '\\/');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyForSigning)
        .digest('hex');
      
      if (receivedSignature !== expectedSignature) {
        console.warn('[Shopify Whitepay Callback] Signature mismatch!');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const eventType = body.event_type;
    const orderData = body.order;
    
    if (!orderData || !orderData.external_order_id) {
      return NextResponse.json({ received: true, ignored: true, reason: 'No external_order_id' });
    }

    // external_order_id format: "store.myshopify.com_123456789"
    const rawExternalId = String(orderData.external_order_id);
    const splitIndex = rawExternalId.indexOf('_');
    
    if (splitIndex === -1) {
      return NextResponse.json({ received: true, ignored: true, reason: 'Invalid external_order_id format' });
    }

    const storeDomain = rawExternalId.substring(0, splitIndex);
    const orderId = rawExternalId.substring(splitIndex + 1);

    console.log(`[Shopify Whitepay Callback] Processing order ${orderId} for store ${storeDomain} | Event: ${eventType}`);

    // If order was successfully paid
    if (eventType === 'order::completed' || eventType === 'order::final_amount_was_received') {
      
      // Look up Shopify Admin API token based on storeDomain from DB
      const storeData = await prisma.shopifyStore.findUnique({
        where: { shopDomain: storeDomain }
      });
      let shopifyToken = storeData?.accessToken;

      // Fallback for legacy local testing if no DB entry found
      if (!shopifyToken) {
        const envKey = `SHOPIFY_ADMIN_TOKEN_${storeDomain.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
        shopifyToken = process.env[envKey] || process.env.SHOPIFY_ADMIN_TOKEN;
      }

      if (!shopifyToken) {
        console.error(`[Shopify Whitepay Callback] No Shopify OAuth Token found for store ${storeDomain} in DB or Env`);
        return NextResponse.json({ error: 'Shopify API Token missing' }, { status: 500 });
      }

      // 3. Mark Order as Paid in Shopify
      const shopifyApiUrl = `https://${storeDomain}/admin/api/2024-01/orders/${orderId}/transactions.json`;
      
      const transactionPayload = {
        transaction: {
          currency: orderData.currency,
          amount: orderData.value || orderData.received_total || orderData.expected_amount,
          kind: 'sale', // 'sale' captures the payment immediately
          gateway: 'WhiteBIT Crypto',
          status: 'success'
        }
      };

      console.log(`[Shopify] Sending transaction capture to ${shopifyApiUrl}`);

      const shopifyRes = await fetch(shopifyApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyToken
        },
        body: JSON.stringify(transactionPayload)
      });

      if (!shopifyRes.ok) {
        const errorData = await shopifyRes.text();
        console.error(`[Shopify] Failed to mark order Paid: HTTP ${shopifyRes.status}`, errorData);
        // Do not fail the Whitepay webhook, otherwise Whitepay retries indefinitely
        return NextResponse.json({ received: true, error: 'Failed to update Shopify', details: errorData });
      }

      console.log(`[Shopify] ✅ Order ${orderId} marked as PAID on ${storeDomain}`);
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (err: any) {
    console.error('[Shopify Whitepay Callback Error]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
