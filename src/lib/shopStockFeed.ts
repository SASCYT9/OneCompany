import { NextResponse } from 'next/server';

export type StockFeedItem = {
  airtableId: string;
  title: string;
  sku: string;
  ourSku: string;
  brand: string;
  stockQuantity: number;
  price: number;
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

  const normalized = normalizeText(value).replace(/\s+/g, '').replace(',', '.');
  const matchedNumber = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!matchedNumber) {
    return 0;
  }

  const parsed = Number(matchedNumber[0]);
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
      items.push({
        airtableId: record.id,
        title: normalizeText(fields['Название']),
        sku: normalizeText(fields['Парт-номер производителя']),
        ourSku: normalizeText(fields['Наш парт-номер']),
        brand: normalizeBrand(fields['Бренд']),
        stockQuantity: Math.trunc(parseNumeric(fields['Кол-во в наличии'])),
        price: parseNumeric(fields['РРЦ в Украине']),
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
  const header = ['airtable_id', 'our_sku', 'manufacturer_sku', 'brand', 'title', 'quantity', 'price_uah'];
  const rows = items.map((item) =>
    [
      csvEscape(item.airtableId),
      csvEscape(item.ourSku),
      csvEscape(item.sku),
      csvEscape(item.brand),
      csvEscape(item.title),
      item.stockQuantity,
      item.price,
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
