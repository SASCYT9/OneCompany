export type AtomicEuPriceMatch = {
  status: "matched";
  sku: string;
  normalizedSku: string;
  handle: string;
  productTitle: string;
  vendor: string | null;
  variantId: number | string | null;
  variantSku: string;
  priceEurNet: number;
  rawPrice: string;
  sourceUrl: string;
  observations: AtomicEuPriceObservation[];
};

export type AtomicEuPriceSkip = {
  status: "skipped";
  sku: string;
  normalizedSku: string;
  reason: "missing_sku" | "not_found" | "no_exact_variant" | "ambiguous" | "fetch_error";
  message?: string;
  observations: AtomicEuPriceObservation[];
};

export type AtomicEuPriceResult = AtomicEuPriceMatch | AtomicEuPriceSkip;

export type AtomicEuPriceObservation = {
  source: "search-suggest" | "product-json";
  handle?: string | null;
  title?: string | null;
  variantId?: number | string | null;
  sku?: string | null;
  rawPrice?: string | null;
  parsedPriceEur?: number | null;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const ATOMIC_EU_BASE_URL = "https://atomic-shop.eu";
const ATOMIC_EU_COUNTRY = "UA";
const ATOMIC_FETCH_TIMEOUT_MS = 12_000;

export function normalizeAtomicSku(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

export function parseAtomicEuPrice(value: unknown): number | null {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  raw = raw.replace(/[^\d,.-]/g, "");
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const commaIndex = raw.lastIndexOf(",");
    const dotIndex = raw.lastIndexOf(".");
    raw = commaIndex > dotIndex ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (hasComma) {
    raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function extractAtomicHandle(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const productMatch = raw.match(/\/products\/([^/?#]+)/i);
  if (productMatch?.[1]) return productMatch[1];

  const clean = raw.replace(/^\/+|\/+$/g, "");
  return clean && !clean.includes("/") ? clean : null;
}

function buildSuggestUrl(sku: string): string {
  const params = new URLSearchParams({
    q: sku,
    "resources[type]": "product",
    "resources[limit]": "10",
    country: ATOMIC_EU_COUNTRY,
  });
  return `${ATOMIC_EU_BASE_URL}/search/suggest.json?${params.toString()}`;
}

function buildProductJsonUrl(handle: string): string {
  return `${ATOMIC_EU_BASE_URL}/products/${encodeURIComponent(handle)}.json?country=${ATOMIC_EU_COUNTRY}`;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
      )
    : [];
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchAtomicJson(
  fetchImpl: FetchLike,
  input: string | URL,
  init: RequestInit
): Promise<{ response: Response; json: unknown | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ATOMIC_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
    const json = response.ok ? await readJson(response) : null;
    return { response, json };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAtomicEuNetPriceBySku(
  sku: string,
  options: {
    fetchImpl?: FetchLike;
  } = {}
): Promise<AtomicEuPriceResult> {
  const normalizedSku = normalizeAtomicSku(sku);
  const observations: AtomicEuPriceObservation[] = [];
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!normalizedSku) {
    return { status: "skipped", sku, normalizedSku, reason: "missing_sku", observations };
  }

  try {
    const suggestResult = await fetchAtomicJson(fetchImpl, buildSuggestUrl(sku), {
      headers: { accept: "application/json" },
    });
    const suggestResponse = suggestResult.response;
    if (!suggestResponse.ok) {
      return {
        status: "skipped",
        sku,
        normalizedSku,
        reason: "fetch_error",
        message: `search/suggest returned ${suggestResponse.status}`,
        observations,
      };
    }

    const suggestJson = suggestResult.json as Record<string, unknown> | null;
    const resources = suggestJson?.resources as Record<string, unknown> | undefined;
    const results = resources?.results as Record<string, unknown> | undefined;
    const products = asArray(results?.products);

    const handles = new Set<string>();
    for (const product of products) {
      const handle = extractAtomicHandle(product.handle ?? product.url);
      const rawPrice = product.price != null ? String(product.price) : null;
      observations.push({
        source: "search-suggest",
        handle,
        title: product.title != null ? String(product.title) : null,
        rawPrice,
        parsedPriceEur: parseAtomicEuPrice(rawPrice),
      });
      if (handle) handles.add(handle);
    }

    if (!handles.size) {
      return { status: "skipped", sku, normalizedSku, reason: "not_found", observations };
    }

    const exactMatches: AtomicEuPriceMatch[] = [];

    for (const handle of handles) {
      const productResult = await fetchAtomicJson(fetchImpl, buildProductJsonUrl(handle), {
        headers: { accept: "application/json" },
      });
      const productResponse = productResult.response;
      if (!productResponse.ok) {
        observations.push({
          source: "product-json",
          handle,
          parsedPriceEur: null,
        });
        continue;
      }

      const productJson = productResult.json as Record<string, unknown> | null;
      const product = productJson?.product as Record<string, unknown> | undefined;
      const title = product?.title != null ? String(product.title) : "";
      const vendor = product?.vendor != null ? String(product.vendor) : null;
      const variants = asArray(product?.variants);

      for (const variant of variants) {
        const variantSku = variant.sku != null ? String(variant.sku).trim() : "";
        const rawPrice = variant.price != null ? String(variant.price) : "";
        const parsedPrice = parseAtomicEuPrice(rawPrice);
        observations.push({
          source: "product-json",
          handle,
          title,
          variantId: (variant.id as number | string | null | undefined) ?? null,
          sku: variantSku,
          rawPrice,
          parsedPriceEur: parsedPrice,
        });

        if (normalizeAtomicSku(variantSku) !== normalizedSku || parsedPrice == null) {
          continue;
        }

        exactMatches.push({
          status: "matched",
          sku,
          normalizedSku,
          handle,
          productTitle: title,
          vendor,
          variantId: (variant.id as number | string | null | undefined) ?? null,
          variantSku,
          priceEurNet: parsedPrice,
          rawPrice,
          sourceUrl: `${ATOMIC_EU_BASE_URL}/products/${handle}?country=${ATOMIC_EU_COUNTRY}`,
          observations,
        });
      }
    }

    if (!exactMatches.length) {
      return { status: "skipped", sku, normalizedSku, reason: "no_exact_variant", observations };
    }

    const distinctMatches = new Map<string, AtomicEuPriceMatch>();
    for (const match of exactMatches) {
      distinctMatches.set(`${match.handle}:${match.variantId ?? match.variantSku}`, match);
    }

    if (distinctMatches.size > 1) {
      return {
        status: "skipped",
        sku,
        normalizedSku,
        reason: "ambiguous",
        message: `Exact SKU matched ${distinctMatches.size} Atomic variants`,
        observations,
      };
    }

    return Array.from(distinctMatches.values())[0];
  } catch (error) {
    return {
      status: "skipped",
      sku,
      normalizedSku,
      reason: "fetch_error",
      message: error instanceof Error ? error.message : String(error),
      observations,
    };
  }
}
