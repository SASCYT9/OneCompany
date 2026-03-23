/**
 * Hutko Payment Gateway Integration
 * 
 * Scheme B: host-to-host JSON POST to get checkout_url
 * Docs: https://docs.hutko.org/uk/docs/page/3/
 * 
 * Required env vars:
 *   HUTKO_MERCHANT_ID — merchant ID from hutko portal
 *   HUTKO_PASSWORD    — merchant password for signature
 */

import crypto from 'crypto';

const HUTKO_CHECKOUT_URL = 'https://pay.hutko.org/api/checkout/url/';

function getMerchantId(): string {
  const id = process.env.HUTKO_MERCHANT_ID;
  if (!id) throw new Error('HUTKO_MERCHANT_ID is not configured');
  return id;
}

function getMerchantPassword(): string {
  const pw = process.env.HUTKO_PASSWORD;
  if (!pw) throw new Error('HUTKO_PASSWORD is not configured');
  return pw;
}

/**
 * Generate Hutko signature.
 * SHA1 of: password + all non-empty params sorted alphabetically by key, joined by |
 */
export function generateHutkoSignature(params: Record<string, string>): string {
  const password = getMerchantPassword();
  
  // merge merchant_id into params
  const allParams: Record<string, string> = {
    ...params,
    merchant_id: getMerchantId(),
  };

  // filter out empty values and 'signature' if present
  const filtered = Object.entries(allParams)
    .filter(([key, val]) => key !== 'signature' && val !== '' && val != null)
    .sort(([a], [b]) => a.localeCompare(b));

  // values only, prepended with password
  const values = filtered.map(([, val]) => val);
  const signatureString = [password, ...values].join('|');

  return crypto.createHash('sha1').update(signatureString).digest('hex');
}

/**
 * Verify Hutko callback signature
 */
export function verifyHutkoSignature(params: Record<string, string>): boolean {
  const receivedSignature = params.signature;
  if (!receivedSignature) return false;

  // Remove signature and response_signature_string from params before verification
  const cleanParams = { ...params };
  delete cleanParams.signature;
  delete cleanParams.response_signature_string;

  const expectedSignature = generateHutkoSignature(cleanParams);
  return receivedSignature === expectedSignature;
}

type HutkoCheckoutParams = {
  orderId: string;
  orderDescription: string;
  /** Amount in kopecks (smallest currency unit). E.g. 100.50 UAH → "10050" */
  amount: string;
  currency: 'UAH' | 'USD' | 'EUR';
  responseUrl: string;
  serverCallbackUrl: string;
  senderEmail?: string;
  lang?: 'uk' | 'en';
};

type HutkoCheckoutResult =
  | { success: true; checkoutUrl: string; paymentId?: string }
  | { success: false; error: string; errorCode?: string };

/**
 * Create Hutko checkout session (Scheme B: host-to-host).
 * Returns checkout_url to redirect the user to.
 */
export async function createHutkoCheckout(params: HutkoCheckoutParams): Promise<HutkoCheckoutResult> {
  const merchantId = getMerchantId();

  // Hutko amount is in kopecks (smallest unit): 100.50 UAH = "10050"
  const requestParams: Record<string, string> = {
    order_id: params.orderId,
    merchant_id: merchantId,
    order_desc: params.orderDescription,
    amount: params.amount,
    currency: params.currency,
    version: '1.0.1',
    response_url: params.responseUrl,
    server_callback_url: params.serverCallbackUrl,
  };

  if (params.senderEmail) {
    requestParams.sender_email = params.senderEmail;
  }
  if (params.lang) {
    requestParams.lang = params.lang;
  }

  // Generate signature
  requestParams.signature = generateHutkoSignature(requestParams);

  try {
    const response = await fetch(HUTKO_CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: requestParams }),
    });

    const data = await response.json();
    const res = data.response || data;

    if (res.response_status === 'success' && res.checkout_url) {
      return {
        success: true,
        checkoutUrl: res.checkout_url,
        paymentId: res.payment_id,
      };
    }

    return {
      success: false,
      error: res.error_message || 'Unknown Hutko error',
      errorCode: res.error_code,
    };
  } catch (err: any) {
    console.error('[Hutko] Checkout request failed:', err);
    return {
      success: false,
      error: err.message || 'Network error',
    };
  }
}

/**
 * Check if Hutko is configured (env vars present)
 */
export function isHutkoEnabled(): boolean {
  return !!(process.env.HUTKO_MERCHANT_ID && process.env.HUTKO_PASSWORD);
}
