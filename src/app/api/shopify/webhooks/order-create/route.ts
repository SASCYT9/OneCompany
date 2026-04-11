import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createWhitepayCryptoOrder } from '@/lib/shopWhitepay';
import { sendShopifyCryptoInvoice } from '@/lib/services/emailService';

export const dynamic = 'force-dynamic';

// Map Shopify internal domains to pretty brand names and public domains
const STORE_BRANDING: Record<string, { displayName: string; publicDomain: string }> = {
  '1t4mqk-bv.myshopify.com': { displayName: 'Eventuri Shop Ukraine', publicDomain: 'eventuri.shop' },
  'eventuri-ua.myshopify.com': { displayName: 'Eventuri Shop Ukraine', publicDomain: 'eventuri.shop' },
  'dvstz5-vy.myshopify.com': { displayName: 'Fi Exhaust Ukraine', publicDomain: 'fiexhaust.shop' },
  'fiexaust.myshopify.com': { displayName: 'Fi Exhaust Ukraine', publicDomain: 'fiexhaust.shop' },
  'dhs4v6-0y.myshopify.com': { displayName: 'KW Suspension Ukraine', publicDomain: 'kwsuspension.shop' },
  // Add more stores here as they are onboarded
};

function getStoreBranding(domain: string) {
  return STORE_BRANDING[domain] || { displayName: 'One Company', publicDomain: 'onecompany.global' };
}

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  return hash === hmacHeader;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    
    // Webhook auth
    const hmac = req.headers.get('x-shopify-hmac-sha256');
    const storeDomain = req.headers.get('x-shopify-shop-domain') || 'unknown';
    
    let isValid = false;

    if (storeDomain.includes('fiexhaust') || storeDomain.includes('dvstz5')) {
      // For Fi Exhaust, try both the Store Webhook Secret and Custom App Secret
      const storeSecret = process.env.FIEXHAUST_WEBHOOK_SECRET;
      const appSecret = process.env.FIEXHAUST_APP_SECRET;
      
      isValid = (storeSecret && verifyShopifyWebhook(rawBody, hmac, storeSecret)) || 
                (appSecret && verifyShopifyWebhook(rawBody, hmac, appSecret)) || false;
    } else if (storeDomain.includes('kwsuspension') || storeDomain.includes('dhs4v6')) {
      // For KW Suspension, try both the Store Webhook Secret and Custom App Secret
      const storeSecret = process.env.KWSUSPENSION_WEBHOOK_SECRET;
      const appSecret = process.env.KWSUSPENSION_APP_SECRET;
      
      isValid = (storeSecret && verifyShopifyWebhook(rawBody, hmac, storeSecret)) || 
                (appSecret && verifyShopifyWebhook(rawBody, hmac, appSecret)) || false;
    } else {
      // Default to Eventuri logic
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      if (webhookSecret) {
        isValid = verifyShopifyWebhook(rawBody, hmac, webhookSecret);
      }
    }

    if (!isValid) {
      console.error(`[Shopify Webhook] Invalid HMAC from ${storeDomain}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = JSON.parse(rawBody);
    
    console.log(`[Shopify Webhook] Order Created: #${order.order_number} from ${storeDomain}`);

    // Wait, check if they chose Crypto
    const gateways = order.payment_gateway_names || [];
    const isCrypto = gateways.some((g: string) => 
      g.toLowerCase().includes('crypto') || 
      g.toLowerCase().includes('whitebit') ||
      g.toLowerCase().includes('whitepay')
    );

    if (!isCrypto) {
      console.log(`[Shopify Webhook] Ignored order #${order.order_number}: Selected gateways ${gateways.join(", ")}`);
      return NextResponse.json({ received: true, ignored: true, reason: 'Not crypto payment' });
    }

    if (!order.email) {
      console.error(`[Shopify Webhook] Error: No email for order #${order.order_number}`);
      return NextResponse.json({ error: 'No email' }, { status: 400 });
    }

    // 1. Generate Whitepay Invoice
    // We use order.id (internal Shopify ID) combined with store domain so the callback has the exact DB ID
    const branding = getStoreBranding(storeDomain);
    const externalOrderId = `${storeDomain}_${order.id}`;
    
    console.log(`[Shopify Webhook] Generating Whitepay invoice for external_order_id: ${externalOrderId}`);

    const whitepayRes = await createWhitepayCryptoOrder({
      amount: order.total_price.toString(),
      currency: order.currency.toUpperCase(),
      description: `Order #${order.order_number} — ${branding.displayName}`,
      external_order_id: externalOrderId,
      // For success return them to the Shopify order status page
      successful_link: order.order_status_url || `https://${branding.publicDomain}`,
      failure_link: order.order_status_url || `https://${branding.publicDomain}`,
    });

    if (!whitepayRes.success || !whitepayRes.url) {
      console.error(`[Shopify Webhook] Failed to generate Whitepay invoice for #${order.order_number}`, whitepayRes);
      return NextResponse.json({ error: 'Whitepay invoice generation failed' }, { status: 502 });
    }

    const payUrl = whitepayRes.url;
    console.log(`[Shopify Webhook] Whitepay invoice generated: ${payUrl}`);

    // 2. Send Email Invoice via Resend
    // Shopify sends customer_locale (e.g. "uk", "en", "ru") — map to our locales
    const shopifyLocale = order.customer_locale || order.locale || 'uk';
    const emailLocale = shopifyLocale.startsWith('uk') || shopifyLocale.startsWith('ru') ? 'ua' : 'en';
    
    const emailRes = await sendShopifyCryptoInvoice({
      toEmail: order.email,
      orderNumber: String(order.order_number),
      amount: order.total_price.toString(),
      currency: order.currency.toUpperCase(),
      payUrl: payUrl,
      storeName: branding.displayName,
      publicDomain: branding.publicDomain,
      locale: emailLocale,
    });

    if (!emailRes.success) {
      console.error(`[Shopify Webhook] Failed to send email to ${order.email}`, emailRes);
      // We still return 200 to Shopify so it doesn't retry the webhook endlessly
      return NextResponse.json({ received: true, emailSent: false, error: emailRes.error });
    }

    return NextResponse.json({ received: true, emailSent: true, payUrl });

  } catch (e: any) {
    console.error('[Shopify Webhook] Exception:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
