import { NextResponse } from 'next/server';
import { allAutomotiveBrands, allMotoBrands } from '@/lib/brands';

export type StockFeedItem = {
  airtableId: string;
  title: string;
  sku: string;
  ourSku: string;
  brand: string;
  stockQuantity: number;
  price: number;
  priceCurrencyHint: string;
  stockStatus: 'in_stock' | 'out_of_stock';
};

type StockFeedFilterInput = {
  skuPrefix?: string | null;
  brand?: string | null;
};

const AIRTABLE_STOCK_TABLE_ID = 'tblJk07VK1kk1AK1L';
const AIRTABLE_STOCK_FIELDS = [
  'Название',
  'Парт-номер производителя',
  'Наш парт-номер',
  'Бренд',
  'Кол-во в наличии',
  'РРЦ в Украине',
] as const;
const STOCK_FEED_CACHE_TTL_MS = 1000 * 60 * 5;
const KNOWN_BRAND_NAMES = [...allAutomotiveBrands, ...allMotoBrands]
  .map((brand) => brand.name.trim())
  .filter(Boolean)
  .sort((left, right) => right.length - left.length);
const SKU_BRAND_PREFIX_MAP: Record<string, string> = {
  acl: 'ACL',
  akr: 'Akrapovic',
  apr: 'APR',
  bra: 'Brabus',
  csf: 'CSF',
  do: 'do88',
  ebc: 'EBC',
  end: 'Endless',
  eve: 'Eventuri',
  gir: 'Girodisc',
  gth: 'GTHaus',
  hei: 'Heico',
  hnr: 'H&R',
  kw: 'KW Suspension',
  nit: 'Nitron Suspension',
  nov: 'Novitec',
  prg: 'Pierburg',
  ptf: 'ProTuning Freaks',
  rem: 'Remus',
  vac: 'VAC Motorsports',
  whp: 'Whipple',
};

let cachedStockFeed:
  | {
      expiresAt: number;
      items: StockFeedItem[];
    }
  | null = null;
let inFlightStockFeedRequest: Promise<StockFeedItem[]> | null = null;

function normalizeText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean).join(' / ');
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = normalizeText(value).replace(/[^\d,.\-]/g, '');
  if (!normalized) {
    return 0;
  }

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;
  let canonical = normalized;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

    canonical = canonical.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') {
      canonical = canonical.replace(',', '.');
    }
  } else if (commaCount > 0) {
    const parts = normalized.split(',');
    canonical =
      parts.length === 2 && parts[1] && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : parts.join('');
  } else if (dotCount > 0) {
    const parts = normalized.split('.');
    canonical =
      parts.length === 2 && parts[1] && parts[1].length <= 2
        ? normalized
        : parts.join('');
  }

  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : 0;
}

function looksLikeAirtableRecordId(value: string) {
  return /^rec[a-zA-Z0-9]{14,}$/.test(value);
}

function normalizeBrand(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const parts = normalized
    .split(' / ')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts.length > 0 && parts.every(looksLikeAirtableRecordId) ? '' : normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferBrandFromKnownNames(title: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return '';
  }

  for (const brandName of KNOWN_BRAND_NAMES) {
    const pattern = new RegExp(`(^|\\b)${escapeRegExp(brandName)}(\\b|$)`, 'i');
    if (pattern.test(normalizedTitle)) {
      return brandName;
    }
  }

  return '';
}

function inferBrandFromSku(ourSku: string, manufacturerSku: string) {
  const candidates = [ourSku, manufacturerSku]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const prefix = candidate.split(/[_-]/)[0] || '';
    if (prefix && SKU_BRAND_PREFIX_MAP[prefix]) {
      return SKU_BRAND_PREFIX_MAP[prefix];
    }
  }

  return '';
}

function resolveBrand(value: unknown, title: string, ourSku: string, manufacturerSku: string) {
  const normalizedBrand = normalizeBrand(value);
  if (normalizedBrand) {
    return normalizedBrand;
  }

  return inferBrandFromSku(ourSku, manufacturerSku) || inferBrandFromKnownNames(title);
}

function detectCurrencyHint(value: unknown) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) {
    return '';
  }

  if (normalized.includes('₴') || normalized.includes('UAH')) {
    return 'UAH';
  }

  if (normalized.includes('$') || normalized.includes('USD')) {
    return 'USD';
  }

  if (normalized.includes('€') || normalized.includes('EUR')) {
    return 'EUR';
  }

  if (normalized.includes('£') || normalized.includes('GBP')) {
    return 'GBP';
  }

  return '';
}

function normalizeFilter(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function csvEscape(value: string | number) {
  const text = typeof value === 'number' ? String(value) : value;
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchAirtableStockFeed(): Promise<StockFeedItem[]> {
  const baseId = (process.env.AIRTABLE_BASE_ID || '').trim();
  const personalAccessToken = (process.env.AIRTABLE_PAT || '').trim();

  if (!baseId || !personalAccessToken) {
    throw new Error('Airtable credentials missing');
  }

  const items: StockFeedItem[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${AIRTABLE_STOCK_TABLE_ID}`);
    for (const field of AIRTABLE_STOCK_FIELDS) {
      url.searchParams.append('fields[]', field);
    }
    url.searchParams.set('cellFormat', 'string');
    url.searchParams.set('userLocale', 'en');
    url.searchParams.set('timeZone', 'Europe/Kiev');
    if (offset) {
      url.searchParams.append('offset', offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${personalAccessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      offset?: string;
      records?: Array<{ id: string; fields?: Record<string, unknown> }>;
    };

    for (const record of payload.records ?? []) {
      const fields = record.fields ?? {};
      const title = normalizeText(fields['Название']);
      const manufacturerSku = normalizeText(fields['Парт-номер производителя']);
      const ourSku = normalizeText(fields['Наш парт-номер']);
      const stockQuantity = Math.trunc(parseNumeric(fields['Кол-во в наличии']));
      const price = parseNumeric(fields['РРЦ в Украине']);
      items.push({
        airtableId: record.id,
        title,
        sku: manufacturerSku,
        ourSku,
        brand: resolveBrand(fields['Бренд'], title, ourSku, manufacturerSku),
        stockQuantity,
        price,
        priceCurrencyHint: detectCurrencyHint(fields['РРЦ в Украине']),
        stockStatus: stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
      });
    }

    offset = payload.offset;
  } while (offset);

  return items;
}

async function loadRawStockFeedItems(): Promise<StockFeedItem[]> {
  const now = Date.now();
  if (cachedStockFeed && cachedStockFeed.expiresAt > now) {
    return cachedStockFeed.items;
  }

  if (inFlightStockFeedRequest) {
    return inFlightStockFeedRequest;
  }

  inFlightStockFeedRequest = fetchAirtableStockFeed()
    .then((items) => {
      cachedStockFeed = {
        expiresAt: Date.now() + STOCK_FEED_CACHE_TTL_MS,
        items,
      };
      return items;
    })
    .finally(() => {
      inFlightStockFeedRequest = null;
    });

  return inFlightStockFeedRequest;
}

export function filterStockFeedItems(items: StockFeedItem[], input: StockFeedFilterInput = {}) {
  const skuPrefix = normalizeFilter(input.skuPrefix);
  const brandFilter = normalizeFilter(input.brand);

  return items.filter((item) => {
    if (
      skuPrefix &&
      !item.ourSku.toLowerCase().startsWith(skuPrefix) &&
      !item.sku.toLowerCase().startsWith(skuPrefix)
    ) {
      return false;
    }

    if (!brandFilter) {
      return true;
    }

    return [item.brand, item.title, item.sku, item.ourSku].some((value) =>
      value.toLowerCase().includes(brandFilter)
    );
  });
}

export async function getStockFeedItems(input: StockFeedFilterInput = {}) {
  const items = await loadRawStockFeedItems();
  return filterStockFeedItems(items, input);
}

export function buildStockFeedCsv(items: StockFeedItem[]) {
  const header = [
    'brand',
    'title',
    'our_sku',
    'manufacturer_sku',
    'stock_qty',
    'stock_status',
    'ua_market_rrp',
    'price_currency_hint',
    'airtable_id',
  ];
  const rows = items.map((item) =>
    [
      csvEscape(item.brand),
      csvEscape(item.title),
      csvEscape(item.ourSku),
      csvEscape(item.sku),
      item.stockQuantity,
      csvEscape(item.stockStatus),
      item.price,
      csvEscape(item.priceCurrencyHint),
      csvEscape(item.airtableId),
    ].join(',')
  );

  return `\uFEFF${[header.join(','), ...rows].join('\r\n')}`;
}

export function buildStockFeedPayload(items: StockFeedItem[]) {
  return {
    status: 'success' as const,
    source: 'airtable' as const,
    total_items: items.length,
    timestamp: new Date().toISOString(),
    columns: [
      'brand',
      'title',
      'our_sku',
      'manufacturer_sku',
      'stock_qty',
      'stock_status',
      'ua_market_rrp',
      'price_currency_hint',
      'airtable_id',
    ],
    items,
  };
}

export async function createStockFeedResponse(searchParams: URLSearchParams) {
  const format = (searchParams.get('format') || 'json').trim().toLowerCase();
  const items = await getStockFeedItems({
    skuPrefix: searchParams.get('sku_prefix'),
    brand: searchParams.get('brand'),
  });

  const sharedHeaders = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Access-Control-Allow-Origin': '*',
  };

  if (format === 'csv') {
    return new NextResponse(buildStockFeedCsv(items), {
      headers: {
        ...sharedHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="onecompany-stock-feed.csv"',
      },
    });
  }

  return NextResponse.json(buildStockFeedPayload(items), {
    headers: sharedHeaders,
  });
}
