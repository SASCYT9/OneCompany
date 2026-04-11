/**
 * Whitepay Payment Gateway Integration
 * Docs: https://docs.whitepay.com/9zfKPu1hqeaacleEeek3/
 * 
 * Required env vars:
 *   WHITEPAY_TOKEN
 *   WHITEPAY_SLUG
 */

export function getWhitepayToken(): string {
  return (process.env.WHITEPAY_TOKEN || '').trim();
}

export function getWhitepaySlug(): string {
  return (process.env.WHITEPAY_SLUG || 'onecompany').trim();
}

const API_BASE = 'https://api.whitepay.com';

type WhitepayFiatParams = {
  /** The amount as a string, e.g. "100.50" */
  amount: string;
  currency: string;
  description?: string;
  external_order_id: string;
  /** These are stored on our side but NOT sent to Fiat API (they're crypto-only per docs) */
  successful_link?: string;
  failure_link?: string;
};

type WhitepayCryptoParams = {
  amount: string;
  currency: string;
  description?: string;
  external_order_id: string;
  successful_link: string;
  failure_link: string;
};

export async function createWhitepayFiatOrder(params: WhitepayFiatParams) {
  const token = getWhitepayToken();
  const slug = getWhitepaySlug();
  
  // Fiat API only accepts: amount, currency, external_order_id
  // successful_link and failure_link are configured in the Whitepay CRM payment page settings
  const body: Record<string, string> = {
    amount: params.amount,
    currency: params.currency,
  };
  if (params.external_order_id) body.external_order_id = params.external_order_id;

  try {
    console.log(`[Whitepay Fiat] POST /private-api/orders/${slug}`, JSON.stringify(body));
    
    const res = await fetch(`${API_BASE}/private-api/orders/${slug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
    });
    
    // Sometimes Whitepay responses can be non-json if 500 error
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Non-JSON response: ' + text.substring(0, 100) };
    }

    console.log(`[Whitepay Fiat] Response ${res.status}:`, JSON.stringify(data));

    if (!res.ok) {
      return { success: false, error: data.message || data.error || `HTTP ${res.status} Error`, details: data };
    }

    // Whitepay API returns the payment URL as `acquiring_url` inside the `order` object
    const acquiringUrl = data.order?.acquiring_url || data.acquiring_url || data.order?.acquire_url || data.acquire_url;
    if (acquiringUrl) {
      return { success: true, url: acquiringUrl, orderId: data.order?.id || data.id };
    }

    return { success: false, error: 'acquiring_url not found in response', details: data };
  } catch (err: any) {
    console.error('[Whitepay Fiat]', err);
    return { success: false, error: err.message };
  }
}

export async function createWhitepayCryptoOrder(params: WhitepayCryptoParams) {
  const token = getWhitepayToken();
  const slug = getWhitepaySlug();
  
  try {
    const res = await fetch(`${API_BASE}/private-api/crypto-orders/${slug}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(params),
    });
    
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Non-JSON response: ' + text.substring(0, 100) };
    }

    if (!res.ok) {
      return { success: false, error: data.message || data.error || `HTTP ${res.status} Error`, details: data };
    }

    const acquiringUrl = data.order?.acquiring_url || data.acquiring_url || data.order?.acquire_url || data.acquire_url;
    if (acquiringUrl) {
      return { success: true, url: acquiringUrl, orderId: data.order?.id || data.id };
    }

    return { success: false, error: 'acquiring_url not found in response', details: data };
  } catch (err: any) {
    console.error('[Whitepay Crypto]', err);
    return { success: false, error: err.message };
  }
}

export function isWhitepayEnabled() {
  return !!process.env.WHITEPAY_TOKEN;
}
