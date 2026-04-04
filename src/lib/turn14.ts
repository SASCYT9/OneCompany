/**
 * Turn14 API Client Integration
 * Documentation: https://turn14.com/api_settings.php
 */

const TURN14_API_BASE = 'https://api.turn14.com/v1';

// We use the provided credentials or fallback to env for security.
const CLIENT_ID = process.env.TURN14_CLIENT_ID || 'f7a47aba33fa6f87a218de26e824d32e499d58e9';
const CLIENT_SECRET = process.env.TURN14_CLIENT_SECRET || 'efc5ff7645b09faa8c9b5c602a6c8fec2937f89f';

// Simple in-memory token cache for the Node process
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getTurn14AccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  console.log('[Turn14] Fetching new OAuth token...');
  
  const response = await fetch(`${TURN14_API_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[Turn14] Token error:', err);
    throw new Error('Failed to fetch Turn14 token');
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Expire token 5 minutes before actual expiration (usually it's 3600 seconds)
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return cachedToken!;
}

export async function fetchTurn14Brands() {
  const token = await getTurn14AccessToken();
  const response = await fetch(`${TURN14_API_BASE}/brands`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Turn14 brands');
  }

  return response.json();
}

/**
 * Searches items in Turn14 catalog. 
 * Supports various filters depending on the API specs.
 */
/**
 * Find a Turn14 Brand ID by exact name match (case-insensitive).
 */
export async function findTurn14BrandIdByName(brandName: string): Promise<string | null> {
  const brandsRes = await fetchTurn14Brands();
  const items = brandsRes.data || (Array.isArray(brandsRes) ? brandsRes : []);
  const match = items.find((b: any) => {
    const name = b.attributes?.name || b.name || '';
    return name.toLowerCase() === brandName.toLowerCase();
  });
  return match?.id || null;
}

/**
 * Fetch ALL items for a given Brand ID, page by page.
 * Returns the raw items array and pagination meta.
 */
export async function fetchTurn14ItemsByBrand(brandId: string, page = 1): Promise<{ data: any[]; meta: any }> {
  const token = await getTurn14AccessToken();
  const url = new URL(`${TURN14_API_BASE}/items`);
  url.searchParams.set('brand_id', brandId);
  url.searchParams.set('page', page.toString());

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turn14 items by brand failed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Fetch detailed data for a single Turn14 item (pricing, media, fitment).
 */
export async function fetchTurn14ItemDetail(itemId: string): Promise<any> {
  const token = await getTurn14AccessToken();
  const response = await fetch(`${TURN14_API_BASE}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turn14 item detail failed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Fetch pricing data for a single Turn14 item.
 */
export async function fetchTurn14ItemPricing(itemId: string): Promise<any> {
  const token = await getTurn14AccessToken();
  const response = await fetch(`${TURN14_API_BASE}/pricing/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) return null; // Pricing may not always exist
  return response.json();
}

export async function searchTurn14Items(keyword: string, page = 1, filters: { brand?: string, brandId?: string, make?: string, model?: string, year?: string, submodel?: string } = {}) {
  const token = await getTurn14AccessToken();
  const url = new URL(`${TURN14_API_BASE}/items`);

  // Page
  url.searchParams.set('page', page.toString());

  // Vehicle fitment filters (these are the params Turn14 items API actually uses)
  if (filters.year) url.searchParams.set('year', filters.year);
  if (filters.make) url.searchParams.set('make', filters.make);
  if (filters.model) url.searchParams.set('model', filters.model);
  if (filters.submodel) url.searchParams.set('submodel', filters.submodel);

  // Brand filter — Turn14 uses brand_id (numeric), not brand name
  if (filters.brandId) {
    url.searchParams.set('brand_id', filters.brandId);
  }

  // Keyword search — only add if present
  if (keyword) url.searchParams.set('keyword', keyword);

  console.log('[Turn14 Search]', url.toString().replace(TURN14_API_BASE, ''));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turn14 search failed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Fetch a shipping quote from Turn14 for a set of items and destination.
 * Endpoint: POST /v1/quote
 */
export async function fetchTurn14ShippingQuote(payload: {
  location?: string;
  items: Array<{ item_id: string; quantity: number }>;
  destination?: {
    name?: string;
    address?: string;
    address_2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  attributes?: any;
}): Promise<any> {
  const token = await getTurn14AccessToken();
  const response = await fetch(`${TURN14_API_BASE}/quote`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turn14 quote failed: ${response.status} ${text}`);
  }

  return response.json();
}

