/**
 * Stripe Checkout Session for shop orders.
 * Requires STRIPE_SECRET_KEY. Currency: EUR or USD (Stripe supported).
 */

import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
export const stripeEnabled = Boolean(stripeSecretKey);

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!stripeSecretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey, { apiVersion: '2026-02-25.clover' });
  }
  return stripeClient;
}

/** Stripe supports EUR, USD; UAH may need different handling. Use EUR/USD for session. */
export function stripeSupportedCurrency(currency: string): 'eur' | 'usd' | null {
  const c = currency.toUpperCase();
  if (c === 'EUR') return 'eur';
  if (c === 'USD') return 'usd';
  return null;
}

/** Create Checkout Session for an order. Amount in smallest unit (cents). */
export async function createStripeCheckoutSession(params: {
  orderId: string;
  orderNumber: string;
  amountTotalCents: number;
  currency: 'eur' | 'usd';
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  locale?: string;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripeClient();
  if (!stripe) return { error: 'Stripe not configured' };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amountTotalCents,
            product_data: {
              name: `One Company — Замовлення #${params.orderNumber}`,
              description: `Email: ${params.customerEmail}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        orderId: params.orderId,
        orderNumber: params.orderNumber,
      },
      locale: (params.locale === 'ua' ? 'uk' : 'en') as 'en' | 'uk',
    } as Stripe.Checkout.SessionCreateParams);

    const url = session.url;
    if (!url) return { error: 'Stripe did not return checkout URL' };
    return { url, sessionId: session.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe error';
    console.error('Stripe Checkout Session create failed', e);
    return { error: message };
  }
}
