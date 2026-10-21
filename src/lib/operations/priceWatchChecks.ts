import { ShopCatalogStatus, type Prisma, type PrismaClient } from "@prisma/client";

import {
  calculateCtCarbonPriceUsd,
  ctCarbonSitePriceGbp,
  CT_CARBON_GBP_USD,
  type CtCarbonDelivery,
} from "@/lib/ctCarbonCatalog";
import { calculateLinkEcuPriceEur } from "@/lib/linkEcuCatalog";
import { calculateMstRetailPrice } from "@/lib/mstCatalog";
import { normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import { repriceShopSourceMoney, type ShopPriceBookRates } from "@/lib/shopPriceBookCurrency";
import {
  PRICE_WATCH_FORMULA_FX,
  PRICE_WATCH_FX_ALERT_PCT,
  type PriceWatchCurrency,
  type PriceWatchShopifyFeed,
  type PriceWatchSourceDefinition,
} from "@/lib/operations/priceWatchSources";

/**
 * Supplier price checks. Every check reads the supplier politely (one request
 * at a time, a pause between pages), recalculates what our price should be
 * and returns only the differences. Nothing here writes to the catalog.
 */

export const PRICE_WATCH_USER_AGENT =
  "Mozilla/5.0 (compatible; OneCompanyPriceWatch/1.0; +https://onecompany.global)";
/** Smaller differences are rounding noise: under 1 % of the price or under 5 €/$/£ (200 ₴). */
export const PRICE_WATCH_MIN_SHARE = 0.01;
const PRICE_WATCH_MIN_ABSOLUTE: Record<PriceWatchCurrency, number> = {
  EUR: 5,
  USD: 5,
  GBP: 5,
  UAH: 200,
};
/** Findings kept per check; the counts in the summary stay exact. */
export const PRICE_WATCH_FINDINGS_LIMIT = 400;
/** Over this share of our products missing at the supplier means a broken feed, not real removals. */
const PRICE_WATCH_MISSING_LIMIT = 0.3;
/** VAT rates a supplier may add or drop at once (UK 20 %, DE 19 %, NL 21 %…). */
const VAT_FACTORS = [1.17, 1.19, 1.2, 1.21, 1.22, 1.23, 1.24, 1.25, 1.255, 1.27];

export type PriceWatchFindingKind =
  | "cheaper"
  | "dearer"
  | "up"
  | "down"
  | "competitor"
  | "gone"
  | "sold_out"
  | "back_in_stock"
  | "fx";

/**
 * What a supplier (or competitor) shows for one item, for us only: price,
 * stock and weight. Items we do not sell have no product (new at the supplier).
 */
export type PriceWatchFact = {
  supplierKey: string;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  supplierSku: string | null;
  title: string;
  url: string | null;
  price: number | null;
  currency: PriceWatchCurrency | null;
  available: boolean | null;
  availability: string | null;
  weightKg: number | null;
  /** Box size, when the supplier publishes it (Dinan / APR price lists). */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

export type PriceWatchFinding = {
  kind: PriceWatchFindingKind;
  sku: string;
  title: string;
  url?: string | null;
  /** Currency of `ours` and `expected`. */
  currency: PriceWatchCurrency;
  ours?: number | null;
  expected?: number | null;
  /** Supplier price at the previous check / at import, and now. */
  before?: number | null;
  now?: number | null;
  supplierCurrency?: PriceWatchCurrency;
  deltaPct?: number | null;
  isNew?: boolean;
};

export type PriceWatchStatus =
  | "ok"
  | "findings"
  | "baseline"
  | "format_change"
  | "mass_change"
  | "error";

export type PriceWatchMassChange = {
  ratio: number;
  count: number;
  total: number;
  vatLike: boolean;
};

export type PriceWatchSummary = {
  matched?: number;
  missing?: number;
  soldOut?: number;
  /** The supplier shows nearly everything as unavailable; stock is not reported. */
  stockIgnored?: boolean;
  noPrice?: number;
  /** Product pages that did not open this time and were skipped. */
  failedPages?: number;
  counts?: Partial<Record<PriceWatchFindingKind, number>>;
  massChange?: PriceWatchMassChange | null;
  /** CT Carbon: whether the feed price already includes UK VAT. */
  feedVat?: "included" | "excluded";
  /** Set by the runner when the supplier changed how it shows prices since the last check. */
  notice?: string;
  atomic?: {
    runs: number;
    lastAt: string | null;
    hoursSinceLast: number | null;
    updated: number;
    failed: number;
  };
  fx?: {
    date: string;
    gbpUsd: number;
    formulas: Array<{ source: string; gbpUsd: number; driftPct: number }>;
  };
  error?: string;
};

export type PriceWatchCheckResult = {
  status: PriceWatchStatus;
  checked: number;
  findings: PriceWatchFinding[];
  summary: PriceWatchSummary;
  snapshot?: Record<string, number> | null;
  /** Saved to OpsSupplierItem by the runner, never kept in the run. */
  facts?: PriceWatchFact[];
};

/** Progress of a page-by-page check, kept between cron runs. */
export type PriceWatchProgress = {
  startedAt: string;
  offset: number;
  checked: number;
  matched: number;
  missing: number;
  noPrice: number;
  /** Products whose page did not open; skipped this time. */
  failed?: number;
  failedInRow?: number;
  /** Runs in a row that stopped because the site refused; the third ends the check. */
  pauses?: number;
  ratios: number[];
  findings: PriceWatchFinding[];
};

export type PriceWatchContext = {
  client: Pick<PrismaClient, "shopProduct" | "adminAuditLog" | "shopSettings">;
  fetchImpl: typeof fetch;
  now: Date;
  /** Epoch ms after which a page-by-page check stops and continues next run. */
  deadline: number;
  /** Pause between two supplier requests. */
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
  previousSnapshot?: Record<string, number> | null;
};

/** Page sources also hand over the facts of the pages read in this step. */
export type PriceWatchStep =
  | { done: true; result: PriceWatchCheckResult }
  | { done: false; progress: PriceWatchProgress; facts?: PriceWatchFact[] };

export class PriceWatchFetchError extends Error {
  readonly host: string;

  constructor(
    public readonly status: number,
    url: string
  ) {
    const host = new URL(url).host.replace(/^www\./, "");
    super(`${host} returned ${status}`);
    this.name = "PriceWatchFetchError";
    this.host = host;
  }
}

/** Why a check failed, in words for the bot. */
export function describePriceWatchError(error: unknown) {
  if (error instanceof PriceWatchFetchError) {
    if (error.status === 403) return `${error.host} закрыл доступ (403)`;
    if (error.status === 404) return `${error.host}: страница не найдена (404)`;
    if (error.status === 429) return `${error.host} просит подождать (429)`;
    if (error.status >= 500) return `${error.host} не работает (${error.status})`;
    return `${error.host} ответил ${error.status}`;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "сайт не ответил за 20 секунд";
  }
  if (error instanceof TypeError) return "сайт недоступен";
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

function pause(ctx: PriceWatchContext, ms: number) {
  if (ms <= 0) return Promise.resolve();
  return (ctx.sleep ?? ((wait) => new Promise((resolve) => setTimeout(resolve, wait))))(ms);
}

/** A redirect to the site's 404 page (brabus.com does this for removed articles). */
const NOT_FOUND_REDIRECT = /(?:^|\/)404(?:\.html?)?(?:$|[/?#])/i;

/**
 * One GET with retries on 429/5xx. Returns null when the page is gone: 404/410,
 * or a redirect to a 404 page, which is caught without loading that page.
 */
async function fetchSupplier(ctx: PriceWatchContext, url: string, accept: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let status = 0;
    try {
      let response = await ctx.fetchImpl(url, {
        headers: { "user-agent": PRICE_WATCH_USER_AGENT, accept },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        redirect: "manual",
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        if (NOT_FOUND_REDIRECT.test(new URL(location, url).pathname)) return null;
        response = await ctx.fetchImpl(new URL(location, url).toString(), {
          headers: { "user-agent": PRICE_WATCH_USER_AGENT, accept },
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
          redirect: "follow",
        });
      }
      if (response.ok) return response;
      if (response.status === 404 || response.status === 410) return null;
      status = response.status;
      if (status !== 429 && status < 500) throw new PriceWatchFetchError(status, url);
    } catch (error) {
      if (error instanceof PriceWatchFetchError || attempt === 3) throw error;
    }
    if (attempt === 3) throw new PriceWatchFetchError(status || 503, url);
    await pause(ctx, attempt * 4_000);
  }
  throw new PriceWatchFetchError(503, url);
}

// ---------------------------------------------------------------------------
// Comparison and guards (pure)
// ---------------------------------------------------------------------------

function minimumDifference(currency: PriceWatchCurrency, amount: number) {
  return Math.max(PRICE_WATCH_MIN_ABSOLUTE[currency], Math.abs(amount) * PRICE_WATCH_MIN_SHARE);
}

/** Our price against the formula: "cheaper" loses margin, "dearer" loses sales. */
export function comparePriceWithFormula(input: {
  ours: number | null | undefined;
  expected: number;
  currency: PriceWatchCurrency;
}): { kind: "cheaper" | "dearer"; deltaPct: number } | null {
  const ours = Number(input.ours);
  if (!(ours > 0) || !(input.expected > 0)) return null;
  const difference = input.expected - ours;
  if (Math.abs(difference) < minimumDifference(input.currency, ours)) return null;
  return {
    kind: difference > 0 ? "cheaper" : "dearer",
    deltaPct: round1((difference / ours) * 100),
  };
}

/** Supplier price now against the previous check. */
export function compareSupplierChange(input: {
  before: number | null | undefined;
  now: number;
  currency: PriceWatchCurrency;
}): { kind: "up" | "down"; deltaPct: number } | null {
  const before = Number(input.before);
  if (!(before > 0) || !(input.now > 0)) return null;
  const difference = input.now - before;
  if (Math.abs(difference) < minimumDifference(input.currency, before)) return null;
  return { kind: difference > 0 ? "up" : "down", deltaPct: round1((difference / before) * 100) };
}

/**
 * Most prices moved by the same factor at once. A VAT-like factor (×1.20,
 * ÷1.19…) means the supplier changed how it shows prices, not the prices.
 */
export function detectPriceWatchMassChange(ratios: readonly number[]): PriceWatchMassChange | null {
  const valid = ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0);
  const changed = valid.filter((ratio) => Math.abs(ratio - 1) > 0.002);
  if (valid.length < 10 || changed.length < Math.max(10, valid.length * 0.6)) return null;
  const buckets = new Map<number, number[]>();
  for (const ratio of changed) {
    const bucket = Math.round(ratio * 100) / 100;
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), ratio]);
  }
  const [, members] = Array.from(buckets.entries()).sort(
    (left, right) => right[1].length - left[1].length
  )[0];
  if (members.length < changed.length * 0.8) return null;
  const sorted = [...members].sort((left, right) => left - right);
  const ratio = Math.round(sorted[Math.floor(sorted.length / 2)] * 10_000) / 10_000;
  const vatLike = VAT_FACTORS.some(
    (factor) => Math.abs(ratio - factor) <= 0.004 || Math.abs(ratio - 1 / factor) <= 0.004
  );
  return { ratio, count: changed.length, total: valid.length, vatLike };
}

/** Identity of a finding across checks, to tell new findings from known ones. */
export function priceWatchFindingKey(finding: PriceWatchFinding) {
  if (finding.kind === "fx") return `fx:${finding.sku}:${Number(finding.deltaPct) > 0 ? "+" : "-"}`;
  if (finding.kind === "gone" || finding.kind === "sold_out" || finding.kind === "back_in_stock") {
    return `${finding.kind}:${finding.sku}`;
  }
  return `${finding.kind}:${finding.sku}:${finding.expected ?? finding.now ?? ""}`;
}

const KIND_ORDER: PriceWatchFindingKind[] = [
  "cheaper",
  "dearer",
  "competitor",
  "up",
  "down",
  "fx",
  "gone",
  "sold_out",
  "back_in_stock",
];

function sortFindings(findings: PriceWatchFinding[]) {
  return [...findings].sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      Math.abs(Number(right.deltaPct) || 0) - Math.abs(Number(left.deltaPct) || 0) ||
      left.sku.localeCompare(right.sku)
  );
}

export function finishPriceWatchCheck(input: {
  checked: number;
  matched: number;
  missing: number;
  ratios: number[];
  findings: PriceWatchFinding[];
  summary?: PriceWatchSummary;
  snapshot?: Record<string, number> | null;
  baseline?: boolean;
  facts?: PriceWatchFact[];
}): PriceWatchCheckResult {
  const summary: PriceWatchSummary = {
    ...input.summary,
    matched: input.matched,
    missing: input.missing,
  };
  if (input.checked >= 10 && input.missing > input.checked * PRICE_WATCH_MISSING_LIMIT) {
    return {
      status: "error",
      checked: input.checked,
      findings: [],
      summary: {
        ...summary,
        error: `поставщик отдал неполный каталог — не нашёл ${input.missing} из ${input.checked} товаров`,
      },
      snapshot: null,
    };
  }
  const massChange = detectPriceWatchMassChange(input.ratios);
  // A supplier that marks most of its catalog unavailable does not sell online
  // (Link ECU sells through dealers): its stock flag says nothing.
  const soldOut = input.findings.filter((finding) => finding.kind === "sold_out").length;
  const stockMeaningless = input.matched >= 10 && soldOut > input.matched * 0.5;
  if (stockMeaningless) {
    summary.soldOut = 0;
    summary.stockIgnored = true;
  }
  const visible = (
    massChange?.vatLike
      ? input.findings.filter((finding) => finding.kind === "gone" || finding.kind === "sold_out")
      : input.findings
  ).filter((finding) => !(stockMeaningless && finding.kind === "sold_out"));
  const counts: Partial<Record<PriceWatchFindingKind, number>> = {};
  for (const finding of visible) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  const status: PriceWatchStatus = input.baseline
    ? "baseline"
    : massChange?.vatLike
      ? "format_change"
      : massChange
        ? "mass_change"
        : visible.length
          ? "findings"
          : "ok";
  return {
    status,
    checked: input.checked,
    findings: sortFindings(visible).slice(0, PRICE_WATCH_FINDINGS_LIMIT),
    summary: { ...summary, counts, massChange },
    snapshot: input.snapshot,
    facts: stockMeaningless
      ? input.facts?.map((fact) => ({ ...fact, available: null }))
      : input.facts,
  };
}

const gramsToKg = (grams: unknown) => {
  const value = Number(grams);
  return Number.isFinite(value) && value > 0 ? Math.round(value) / 1000 : null;
};

/** schema.org availability: InStock, LimitedAvailability, BackOrder… are buyable; OutOfStock is not. */
export function readSchemaAvailability(value: unknown) {
  const text =
    typeof value === "string" ? value.replace(/^https?:\/\/schema\.org\//i, "").trim() : "";
  if (!text) return { available: null, text: null };
  return { available: !/OutOfStock|SoldOut|Discontinued/i.test(text), text };
}

/** One fact per supplier product we do not sell, so new arrivals can be listed. */
function unmatchedShopifyFact(
  base: string,
  product: ShopifyFeedProduct,
  currency: PriceWatchCurrency
): PriceWatchFact {
  const prices = product.variants.map(shopifyRegularPrice).filter((price) => price > 0);
  return {
    supplierKey: `p${product.id}`,
    productId: null,
    variantId: null,
    sku: null,
    supplierSku: product.variants[0]?.sku ?? null,
    title: product.title,
    url: `${base}/products/${encodeURIComponent(product.handle)}`,
    price: prices.length ? Math.min(...prices) : null,
    currency,
    available: product.variants.some((variant) => variant.available !== false),
    availability: null,
    weightKg: gramsToKg(product.variants[0]?.grams),
  };
}

// ---------------------------------------------------------------------------
// Page parsing (pure)
// ---------------------------------------------------------------------------

export type JsonLdOffer = {
  price: number;
  currency: string | null;
  availability: string | null;
  sku: string | null;
  mpn: string | null;
};

const textOrNull = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : null;

function findProductOffer(node: unknown, depth = 0): JsonLdOffer | null {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductOffer(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.includes("Product")) {
    const offers = Array.isArray(record.offers) ? record.offers : [record.offers];
    for (const offer of offers) {
      if (!offer || typeof offer !== "object") continue;
      const entry = offer as Record<string, unknown>;
      const price = Number(entry.price ?? entry.lowPrice);
      if (Number.isFinite(price) && price > 0) {
        return {
          price,
          currency: typeof entry.priceCurrency === "string" ? entry.priceCurrency : null,
          availability: textOrNull(entry.availability),
          sku: textOrNull(record.sku ?? entry.sku),
          mpn: textOrNull(record.mpn ?? entry.mpn),
        };
      }
    }
  }
  return record["@graph"] ? findProductOffer(record["@graph"], depth + 1) : null;
}

/** Price, stock and part numbers from the schema.org Product block of a page. */
export function extractJsonLdProductPrice(html: string) {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const found = findProductOffer(JSON.parse(match[1].trim()));
      if (found) return found;
    } catch {
      // A broken block is skipped; another one may hold the product.
    }
  }
  return null;
}

/** Sendit (BigCommerce) page: the regular price with VAT, never a sale price. */
export function extractSenditPriceGbp(html: string) {
  const read = (name: string) => {
    const match = html.match(
      new RegExp(`"${name}":\\{"formatted":"[^"]*","value":([0-9]+(?:\\.[0-9]+)?)`)
    );
    return match ? Number(match[1]) : 0;
  };
  const withTax = html.match(
    /"price":\{"with_tax":\{"formatted":"[^"]*","value":([0-9]+(?:\.[0-9]+)?)/
  );
  const regular = Math.max(withTax ? Number(withTax[1]) : 0, read("non_sale_price_with_tax"));
  return regular > 0 ? regular : null;
}

export function brabusSkuKey(value: string) {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * brabus.com sitemap: article pages end with the SKU ("…/254-263-99.html").
 * One article is often listed under several models, and some of those pages
 * are gone, so every page of a SKU is kept.
 */
export function parseBrabusSitemap(xml: string) {
  const urls = new Map<string, string[]>();
  for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    if (!loc.includes("/artikel/p/")) continue;
    const last = loc.split("/").pop() ?? "";
    let sku = last.replace(/\.html$/i, "");
    try {
      sku = decodeURIComponent(sku);
    } catch {
      // Keep the raw segment.
    }
    const key = brabusSkuKey(sku);
    if (key) urls.set(key, [...(urls.get(key) ?? []), loc]);
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Supplier feeds
// ---------------------------------------------------------------------------

export type ShopifyFeedVariant = {
  id: number;
  sku?: string | null;
  title?: string;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  available?: boolean;
  grams?: number | null;
};

export type ShopifyFeedProduct = {
  id: number;
  handle: string;
  title: string;
  variants: ShopifyFeedVariant[];
};

/** The regular price: during a sale Shopify keeps it in compare_at_price. */
export function shopifyRegularPrice(variant: ShopifyFeedVariant) {
  return Math.max(Number(variant.price) || 0, Number(variant.compare_at_price) || 0);
}

export async function fetchShopifyFeed(
  ctx: PriceWatchContext,
  feed: Pick<PriceWatchShopifyFeed, "base" | "collection" | "query">
) {
  const root = `${feed.base.replace(/\/$/, "")}${
    feed.collection ? `/collections/${feed.collection}` : ""
  }/products.json`;
  const products: ShopifyFeedProduct[] = [];
  for (let page = 1; page <= 60; page += 1) {
    const response = await fetchSupplier(
      ctx,
      `${root}?limit=250&page=${page}${feed.query ?? ""}`,
      "application/json"
    );
    if (!response) throw new PriceWatchFetchError(404, root);
    const body = (await response.json()) as { products?: ShopifyFeedProduct[] };
    const batch = Array.isArray(body.products) ? body.products : [];
    products.push(...batch);
    if (batch.length < 250) break;
    await pause(ctx, ctx.delayMs);
  }
  // An empty feed is a broken feed, not a supplier that sells nothing.
  if (!products.length) throw new Error(`${new URL(root).host} returned no products`);
  return products;
}

// ---------------------------------------------------------------------------
// Our catalog
// ---------------------------------------------------------------------------

const CATALOG_SELECT = {
  id: true,
  sku: true,
  slug: true,
  titleEn: true,
  titleUa: true,
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  priceSourceCurrency: true,
  brand: true,
  variants: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      sku: true,
      title: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      priceSourceCurrency: true,
    },
  },
} satisfies Prisma.ShopProductSelect;

export type PriceWatchCatalogVariant = {
  id: string;
  sku: string | null;
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceSourceCurrency: string | null;
};

export type PriceWatchCatalogProduct = {
  id: string;
  sku: string | null;
  slug: string;
  title: string;
  brand: string | null;
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceSourceCurrency: string | null;
  variants: PriceWatchCatalogVariant[];
  meta: Record<string, unknown>;
};

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/** Published products of the brands, with their metafields from the given namespaces. */
export async function loadPriceWatchCatalog(
  client: Pick<PrismaClient, "shopProduct">,
  brands: readonly string[],
  namespaces: readonly string[] = []
): Promise<PriceWatchCatalogProduct[]> {
  const rows = await client.shopProduct.findMany({
    where: { status: ShopCatalogStatus.ACTIVE, isPublished: true, brand: { in: [...brands] } },
    orderBy: [{ sku: "asc" }, { id: "asc" }],
    select: {
      ...CATALOG_SELECT,
      metafields: {
        where: { namespace: { in: [...namespaces] } },
        select: { key: true, value: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    title: row.titleEn || row.titleUa,
    brand: row.brand,
    priceEur: toNumber(row.priceEur),
    priceUsd: toNumber(row.priceUsd),
    priceUah: toNumber(row.priceUah),
    priceSourceCurrency: row.priceSourceCurrency,
    variants: row.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      priceEur: toNumber(variant.priceEur),
      priceUsd: toNumber(variant.priceUsd),
      priceUah: toNumber(variant.priceUah),
      priceSourceCurrency: variant.priceSourceCurrency,
    })),
    meta: Object.fromEntries(row.metafields.map((field) => [field.key, field.value])),
  }));
}

function parseJsonValue<T>(value: unknown): T | null {
  if (value && typeof value === "object") return value as T;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string" ? parseJsonValue<T>(parsed) : (parsed as T);
  } catch {
    return null;
  }
}

/** A variant without its own price inherits the product price. */
function ourPrice(
  product: PriceWatchCatalogProduct,
  variant: PriceWatchCatalogVariant | null,
  currency: "EUR" | "USD"
) {
  const field = currency === "EUR" ? "priceEur" : "priceUsd";
  return variant?.[field] ?? product[field];
}

const normalizeSku = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

type CtStoredVariant = {
  supplierSku?: string | null;
  priceExVatGbp?: number;
  sitePriceGbp?: number;
  priceUsd?: number;
};
type CtStoredPricing = {
  delivery?: Pick<CtCarbonDelivery, "medykaGbp" | "ukraineUsd">;
  variants?: CtStoredVariant[];
};

async function checkCtCarbon(def: PriceWatchSourceDefinition, ctx: PriceWatchContext) {
  const base = def.url ?? "https://www.ctcarbon.co";
  const [catalog, feed] = await Promise.all([
    loadPriceWatchCatalog(ctx.client, def.brands, ["ct_carbon_import"]),
    fetchShopifyFeed(ctx, { base }),
  ]);
  const byId = new Map(feed.map((product) => [String(product.id), product]));
  const findings: PriceWatchFinding[] = [];
  const facts: PriceWatchFact[] = [];
  const sold = new Set<string>();
  const pairs: Array<{
    sku: string;
    title: string;
    url: string;
    ours: number | null;
    stored: CtStoredVariant | null;
    regular: number;
    delivery: Pick<CtCarbonDelivery, "medykaGbp" | "ukraineUsd">;
  }> = [];
  let missing = 0;
  let soldOut = 0;
  for (const product of catalog) {
    const productId = /^CTC-(\d+)/i.exec(product.sku ?? "")?.[1];
    if (!productId) continue;
    sold.add(productId);
    const feedProduct = byId.get(productId);
    if (!feedProduct) {
      missing += 1;
      findings.push({
        kind: "gone",
        sku: product.sku ?? product.slug,
        title: product.title,
        url: typeof product.meta.official_url === "string" ? product.meta.official_url : null,
        currency: "USD",
        ours: product.priceUsd,
      });
      continue;
    }
    const url = `${base}/products/${encodeURIComponent(feedProduct.handle)}`;
    if (feedProduct.variants.length && feedProduct.variants.every((v) => v.available === false)) {
      soldOut += 1;
      findings.push({
        kind: "sold_out",
        sku: product.sku ?? product.slug,
        title: product.title,
        url,
        currency: "USD",
        ours: product.priceUsd,
      });
    }
    const pricing = parseJsonValue<CtStoredPricing>(product.meta.pricing);
    if (!pricing?.delivery) continue;
    const ourVariants = product.variants.length ? product.variants : [null];
    ourVariants.forEach((variant, index) => {
      const stored = pricing.variants?.[index] ?? null;
      const variantId = /^CTC-\d+-(\d+)$/i.exec(variant?.sku ?? "")?.[1];
      const feedVariant = variantId
        ? feedProduct.variants.find((entry) => String(entry.id) === variantId)
        : (feedProduct.variants.find(
            (entry) => stored?.supplierSku && entry.sku === stored.supplierSku
          ) ??
          feedProduct.variants.find((entry) => entry.available !== false) ??
          feedProduct.variants[0]);
      const regular = feedVariant ? shopifyRegularPrice(feedVariant) : 0;
      if (!feedVariant || !(regular > 0)) return;
      const sku = variant?.sku ?? product.sku ?? product.slug;
      facts.push({
        supplierKey: `v${feedVariant.id}`,
        productId: product.id,
        variantId: variant?.id ?? null,
        sku,
        supplierSku: feedVariant.sku ?? null,
        title: product.title,
        url,
        price: regular,
        currency: "GBP",
        available: feedVariant.available ?? null,
        availability: null,
        weightKg: gramsToKg(feedVariant.grams),
      });
      pairs.push({
        sku,
        title: product.title,
        url,
        ours: ourPrice(product, variant, "USD"),
        stored,
        regular,
        delivery: pricing.delivery!,
      });
    });
  }
  for (const product of feed) {
    if (!sold.has(String(product.id))) facts.push(unmatchedShopifyFact(base, product, "GBP"));
  }
  // At import (20.10.2026) the feed gave prices without VAT; from 21.10 it gives
  // them with VAT. Decide by which stored price the feed matches.
  let withVat = 0;
  let withoutVat = 0;
  for (const pair of pairs) {
    if (Math.abs(pair.regular - Number(pair.stored?.sitePriceGbp)) < 0.011) withVat += 1;
    else if (Math.abs(pair.regular - Number(pair.stored?.priceExVatGbp)) < 0.011) withoutVat += 1;
  }
  const feedVat = withVat >= withoutVat ? "included" : "excluded";
  const ratios: number[] = [];
  for (const pair of pairs) {
    const siteGbp =
      feedVat === "included" ? round2(pair.regular) : ctCarbonSitePriceGbp(pair.regular);
    const expected = calculateCtCarbonPriceUsd(siteGbp, pair.delivery, CT_CARBON_GBP_USD);
    const before = Number(pair.stored?.sitePriceGbp) || null;
    if (before) ratios.push(siteGbp / before);
    const difference = comparePriceWithFormula({ ours: pair.ours, expected, currency: "USD" });
    if (difference) {
      findings.push({
        kind: difference.kind,
        sku: pair.sku,
        title: pair.title,
        url: pair.url,
        currency: "USD",
        ours: pair.ours,
        expected,
        before,
        now: siteGbp,
        supplierCurrency: "GBP",
        deltaPct: difference.deltaPct,
      });
    }
  }
  return finishPriceWatchCheck({
    checked: catalog.length,
    matched: pairs.length,
    missing,
    ratios,
    findings,
    summary: { feedVat, soldOut },
    facts,
  });
}

async function checkLinkEcu(def: PriceWatchSourceDefinition, ctx: PriceWatchContext) {
  const [catalog, feed] = await Promise.all([
    loadPriceWatchCatalog(ctx.client, def.brands, ["link_ecu_import"]),
    fetchShopifyFeed(ctx, { base: def.url ?? "https://linkecu.com", query: "&currency=EUR" }),
  ]);
  const bySku = new Map<string, { product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>();
  for (const product of feed) {
    for (const variant of product.variants) {
      if (variant.sku && !bySku.has(normalizeSku(variant.sku))) {
        bySku.set(normalizeSku(variant.sku), { product, variant });
      }
    }
  }
  const findings: PriceWatchFinding[] = [];
  const facts: PriceWatchFact[] = [];
  const soldProducts = new Set<number>();
  const ratios: number[] = [];
  let matched = 0;
  let missing = 0;
  let soldOut = 0;
  for (const product of catalog) {
    const storedRrp = Number(product.meta.rrp_eur) || null;
    for (const variant of product.variants.length ? product.variants : [null]) {
      const sku = variant?.sku ?? product.sku ?? "";
      const hit = bySku.get(normalizeSku(sku));
      const ours = ourPrice(product, variant, "EUR");
      if (!hit) {
        missing += 1;
        findings.push({ kind: "gone", sku, title: product.title, currency: "EUR", ours });
        continue;
      }
      matched += 1;
      soldProducts.add(hit.product.id);
      const url = `${def.url ?? "https://linkecu.com"}/products/${encodeURIComponent(hit.product.handle)}`;
      facts.push({
        supplierKey: `v${hit.variant.id}`,
        productId: product.id,
        variantId: variant?.id ?? null,
        sku,
        supplierSku: hit.variant.sku ?? null,
        title: product.title,
        url,
        price: shopifyRegularPrice(hit.variant) || null,
        currency: "EUR",
        available: hit.variant.available ?? null,
        availability: null,
        weightKg: gramsToKg(hit.variant.grams),
      });
      if (hit.variant.available === false) {
        soldOut += 1;
        findings.push({ kind: "sold_out", sku, title: product.title, url, currency: "EUR", ours });
      }
      const rrp = shopifyRegularPrice(hit.variant);
      if (!(rrp > 0)) continue;
      const expected = calculateLinkEcuPriceEur(rrp);
      if (storedRrp) ratios.push(rrp / storedRrp);
      const difference = comparePriceWithFormula({ ours, expected, currency: "EUR" });
      if (difference) {
        findings.push({
          kind: difference.kind,
          sku,
          title: product.title,
          url,
          currency: "EUR",
          ours,
          expected,
          before: storedRrp,
          now: rrp,
          supplierCurrency: "EUR",
          deltaPct: difference.deltaPct,
        });
      }
    }
  }
  for (const product of feed) {
    if (!soldProducts.has(product.id)) {
      facts.push(unmatchedShopifyFact(def.url ?? "https://linkecu.com", product, "EUR"));
    }
  }
  return finishPriceWatchCheck({
    checked: catalog.length,
    matched,
    missing,
    ratios,
    findings,
    summary: { soldOut },
    facts,
  });
}

type PagePlanItem = {
  productId: string;
  sku: string;
  title: string;
  /** Pages of the product at the supplier, tried in order until one shows a price. */
  urls: string[];
  ours: number | null;
  /** Supplier price recorded at import, when the import kept it. */
  baseline: number | null;
  /** Stock and weight known from elsewhere (MST's own site), preferred over the page. */
  known?: { available: boolean | null; availability: string | null; weightKg: number | null };
};

type PageOffer = { price: number | null; availability: string | null };

function newProgress(now: Date): PriceWatchProgress {
  return {
    startedAt: now.toISOString(),
    offset: 0,
    checked: 0,
    matched: 0,
    missing: 0,
    noPrice: 0,
    ratios: [],
    findings: [],
  };
}

/** Reads product pages one by one; stops at the run's page budget and resumes next run. */
async function stepProductPages(input: {
  def: PriceWatchSourceDefinition;
  ctx: PriceWatchContext;
  progress: PriceWatchProgress | null;
  plan: PagePlanItem[];
  currency: PriceWatchCurrency;
  supplierCurrency: PriceWatchCurrency;
  readOffer: (html: string) => PageOffer;
  expectedPrice: (supplierPrice: number) => number;
  /** Our price derived from the supplier price when the import kept no baseline. */
  impliedBaseline?: (ours: number) => number;
}): Promise<PriceWatchStep> {
  const { ctx, def, plan } = input;
  const state = input.progress ?? newProgress(ctx.now);
  const facts: PriceWatchFact[] = [];
  let pages = 0;
  while (state.offset < plan.length) {
    if (pages >= (def.pagesPerRun ?? 50) || Date.now() > ctx.deadline) {
      return { done: false, progress: state, facts };
    }
    const item = plan[state.offset];
    state.offset += 1;
    state.checked += 1;
    let url: string | null = null;
    let found = false;
    let failed = false;
    let offer: PageOffer = { price: null, availability: null };
    for (const candidate of item.urls) {
      pages += 1;
      let response: Response | null;
      try {
        response = await fetchSupplier(ctx, candidate, "text/html");
        state.failedInRow = 0;
      } catch (error) {
        // One page that will not open is skipped; a site that is down stops the check.
        state.failedInRow = (state.failedInRow ?? 0) + 1;
        if (state.failedInRow >= 8) throw error;
        failed = true;
        continue;
      }
      if (response) {
        found = true;
        url = candidate;
        offer = input.readOffer(await response.text());
      }
      await pause(ctx, response ? ctx.delayMs : Math.min(ctx.delayMs, 300));
      if (offer.price) break;
    }
    const supplierPrice = offer.price;
    if (failed && !supplierPrice) {
      state.failed = (state.failed ?? 0) + 1;
      continue;
    }
    if (!found) {
      state.missing += 1;
      state.findings.push({
        kind: "gone",
        sku: item.sku,
        title: item.title,
        currency: input.currency,
        ours: item.ours,
      });
      continue;
    }
    const stock =
      item.known?.available != null ? item.known : readSchemaAvailability(offer.availability);
    facts.push({
      supplierKey: item.sku.toLowerCase(),
      productId: item.productId,
      variantId: null,
      sku: item.sku,
      supplierSku: item.sku,
      title: item.title,
      url,
      price: supplierPrice,
      currency: input.supplierCurrency,
      available: stock.available,
      availability: "availability" in stock ? stock.availability : stock.text,
      weightKg: item.known?.weightKg ?? null,
    });
    if (stock.available === false) {
      state.findings.push({
        kind: "sold_out",
        sku: item.sku,
        title: item.title,
        url,
        currency: input.currency,
        ours: item.ours,
      });
    }
    if (!supplierPrice) {
      state.noPrice += 1;
      continue;
    }
    state.matched += 1;
    const expected = input.expectedPrice(supplierPrice);
    const baseline =
      item.baseline ??
      (item.ours && input.impliedBaseline ? input.impliedBaseline(item.ours) : null);
    if (baseline) state.ratios.push(supplierPrice / baseline);
    const difference = comparePriceWithFormula({
      ours: item.ours,
      expected,
      currency: input.currency,
    });
    if (difference) {
      state.findings.push({
        kind: difference.kind,
        sku: item.sku,
        title: item.title,
        url,
        currency: input.currency,
        ours: item.ours,
        expected,
        before: baseline,
        now: supplierPrice,
        supplierCurrency: input.supplierCurrency,
        deltaPct: difference.deltaPct,
      });
    }
  }
  return {
    done: true,
    result: finishPriceWatchCheck({
      checked: state.checked,
      matched: state.matched,
      missing: state.missing,
      ratios: state.ratios,
      findings: state.findings,
      summary: {
        noPrice: state.noPrice,
        failedPages: state.failed ?? 0,
        soldOut: state.findings.filter((finding) => finding.kind === "sold_out").length,
      },
      facts,
    }),
  };
}

const BRABUS_SITEMAP = "https://www.brabus.com/de-de/sitemap.xml";
/** Ukraine: brabus.com (DE) price + 10 %. */
const BRABUS_MARKUP = 1.1;

async function stepBrabus(
  def: PriceWatchSourceDefinition,
  ctx: PriceWatchContext,
  progress: PriceWatchProgress | null
) {
  const [catalog, sitemap] = await Promise.all([
    loadPriceWatchCatalog(ctx.client, def.brands),
    fetchSupplier(ctx, BRABUS_SITEMAP, "application/xml"),
  ]);
  if (!sitemap) throw new PriceWatchFetchError(404, BRABUS_SITEMAP);
  const urls = parseBrabusSitemap(await sitemap.text());
  if (urls.size < 100) throw new Error(`brabus.com sitemap lists only ${urls.size} articles`);
  return stepProductPages({
    def,
    ctx,
    progress,
    plan: catalog.map((product) => ({
      productId: product.id,
      sku: product.sku ?? product.slug,
      title: product.title,
      urls: urls.get(brabusSkuKey(product.sku ?? "")) ?? [],
      ours: product.priceEur,
      baseline: null,
    })),
    currency: "EUR",
    supplierCurrency: "EUR",
    readOffer: (html) => {
      const offer = extractJsonLdProductPrice(html);
      return { price: offer?.price ?? null, availability: offer?.availability ?? null };
    },
    expectedPrice: (price) => round2(price * BRABUS_MARKUP),
    impliedBaseline: (ours) => ours / BRABUS_MARKUP,
  });
}

const MST_MANUFACTURER_STORE = "https://www.mst-performance.com";

async function stepMst(
  def: PriceWatchSourceDefinition,
  ctx: PriceWatchContext,
  progress: PriceWatchProgress | null
) {
  const catalog = await loadPriceWatchCatalog(ctx.client, def.brands, ["mst_import"]);
  // Stock and weight come from MST itself; Sendit is the reseller whose price we use.
  const manufacturer = await fetchShopifyFeed(ctx, { base: MST_MANUFACTURER_STORE }).catch(
    (): ShopifyFeedProduct[] => []
  );
  const byHandle = new Map(manufacturer.map((product) => [product.handle.toLowerCase(), product]));
  return stepProductPages({
    def,
    ctx,
    progress,
    plan: catalog.map((product) => {
      const own = byHandle.get(shopifyHandleFromUrl(product.meta.official_url) ?? "");
      return {
        productId: product.id,
        sku: product.sku ?? product.slug,
        title: product.title,
        urls: typeof product.meta.sendit_url === "string" ? [product.meta.sendit_url] : [],
        ours: product.priceUsd,
        baseline: Number(product.meta.sendit_inc_vat_gbp) || null,
        known: own
          ? {
              available: own.variants.some((variant) => variant.available !== false),
              availability: "у MST",
              weightKg: gramsToKg(own.variants[0]?.grams),
            }
          : undefined,
      };
    }),
    currency: "USD",
    supplierCurrency: "GBP",
    readOffer: (html) => ({
      price: extractSenditPriceGbp(html),
      availability: extractJsonLdProductPrice(html)?.availability ?? null,
    }),
    expectedPrice: (price) => calculateMstRetailPrice(price).priceUsd,
  });
}

function matchShopifyVariants(
  match: PriceWatchShopifyFeed["match"],
  sku: string,
  index: {
    byVariantId: Map<string, { product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>;
    byProductId: Map<string, ShopifyFeedProduct>;
    bySku: Map<string, Array<{ product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>>;
  }
) {
  if (match === "burger") {
    // Burger SKUs made at import from Shopify ids: BURGER-V-<variant>, BURGER-<product>.
    const variantId = /^BURGER-V-(\d+)$/i.exec(sku)?.[1];
    if (variantId) {
      const hit = index.byVariantId.get(variantId);
      return hit ? [hit] : [];
    }
    const productId = /^BURGER-(\d+)$/i.exec(sku)?.[1];
    if (productId) {
      const product = index.byProductId.get(productId);
      return product?.variants[0] ? [{ product, variant: product.variants[0] }] : [];
    }
  }
  return index.bySku.get(normalizeSku(sku)) ?? [];
}

/** The supplier's product handle from the page URL our import kept ("…/products/<handle>"). */
export function shopifyHandleFromUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const at = parts.indexOf("products");
    return at >= 0 && parts[at + 1] ? decodeURIComponent(parts[at + 1]).toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Supplier prices compared with the previous check: what went up, down or
 * disappeared. The first check only remembers prices (and what is missing,
 * so it is not reported as news the next day).
 */
async function checkShopifyChanges(def: PriceWatchSourceDefinition, ctx: PriceWatchContext) {
  if (!def.shopify) throw new Error(`${def.key} has no Shopify feed`);
  const byHandle = def.shopify.match === "handle";
  const [catalog, feed] = await Promise.all([
    loadPriceWatchCatalog(ctx.client, def.brands, byHandle ? ["custom"] : []),
    fetchShopifyFeed(ctx, def.shopify),
  ]);
  const feedByHandle = new Map(feed.map((product) => [product.handle.toLowerCase(), product]));
  const index = {
    byVariantId: new Map<string, { product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>(),
    byProductId: new Map<string, ShopifyFeedProduct>(),
    bySku: new Map<string, Array<{ product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>>(),
  };
  for (const product of feed) {
    index.byProductId.set(String(product.id), product);
    for (const variant of product.variants) {
      index.byVariantId.set(String(variant.id), { product, variant });
      if (variant.sku) {
        const key = normalizeSku(variant.sku);
        index.bySku.set(key, [...(index.bySku.get(key) ?? []), { product, variant }]);
      }
    }
  }
  const currency = def.currency ?? "USD";
  const snapshot: Record<string, number> = {};
  const labels = new Map<
    string,
    { sku: string; title: string; ours: number | null; url: string }
  >();
  const unmatched: PriceWatchFinding[] = [];
  const facts: PriceWatchFact[] = [];
  const soldProducts = new Set<number>();
  /** Per our SKU: whether any matched supplier variant can be bought. */
  const stock = new Map<
    string,
    { available: boolean; url: string; title: string; ours: number | null }
  >();
  let missingProducts = 0;
  const remember = (
    matches: Array<{ product: ShopifyFeedProduct; variant: ShopifyFeedVariant }>,
    label: {
      sku: string;
      title: string;
      ours: number | null;
      productId: string;
      variantId: string | null;
    }
  ) => {
    for (const { product: feedProduct, variant: feedVariant } of matches) {
      soldProducts.add(feedProduct.id);
      const key = `v${feedVariant.id}`;
      const price = shopifyRegularPrice(feedVariant);
      const url = `${def.shopify!.base}/products/${encodeURIComponent(feedProduct.handle)}`;
      const seen = stock.get(label.sku);
      stock.set(label.sku, {
        available: Boolean(seen?.available) || feedVariant.available !== false,
        url,
        title: label.title,
        ours: label.ours,
      });
      if (key in snapshot || !(price > 0)) continue;
      snapshot[key] = price;
      labels.set(key, { sku: label.sku, title: label.title, ours: label.ours, url });
      facts.push({
        supplierKey: key,
        productId: label.productId,
        variantId: label.variantId,
        sku: label.sku,
        supplierSku: feedVariant.sku ?? null,
        title: label.title,
        url,
        price,
        currency,
        available: feedVariant.available ?? null,
        availability: null,
        weightKg: gramsToKg(feedVariant.grams),
      });
    }
  };
  for (const product of catalog) {
    if (byHandle) {
      // iPE: our variants are options of one supplier product; its page URL is the link.
      const feedProduct = feedByHandle.get(shopifyHandleFromUrl(product.meta.official_url) ?? "");
      const sku = product.sku ?? product.slug;
      if (!feedProduct) {
        missingProducts += 1;
        unmatched.push({
          kind: "gone",
          sku,
          title: product.title,
          currency: "USD",
          ours: product.priceUsd,
        });
        continue;
      }
      remember(
        feedProduct.variants.map((variant) => ({ product: feedProduct, variant })),
        {
          sku,
          title: product.title,
          ours: product.priceUsd,
          productId: product.id,
          variantId: null,
        }
      );
      continue;
    }
    let anyMatched = false;
    for (const variant of product.variants.length ? product.variants : [null]) {
      const sku = (variant?.sku ?? product.sku ?? "").trim();
      if (!sku) continue;
      const matches = matchShopifyVariants(def.shopify.match, sku, index);
      const ours = ourPrice(product, variant, "USD");
      if (!matches.length) {
        unmatched.push({ kind: "gone", sku, title: product.title, currency: "USD", ours });
        continue;
      }
      anyMatched = true;
      remember(matches, {
        sku,
        title: product.title,
        ours,
        productId: product.id,
        variantId: variant?.id ?? null,
      });
    }
    if (!anyMatched) missingProducts += 1;
  }
  for (const product of feed) {
    if (!soldProducts.has(product.id))
      facts.push(unmatchedShopifyFact(def.shopify.base, product, currency));
  }
  for (const [sku, entry] of stock) {
    if (!entry.available) {
      unmatched.push({
        kind: "sold_out",
        sku,
        title: entry.title,
        url: entry.url,
        currency: "USD",
        ours: entry.ours,
      });
    }
  }
  const previous = ctx.previousSnapshot ?? null;
  const matched = Object.keys(snapshot).length;
  if (!previous || !Object.keys(previous).length) {
    return finishPriceWatchCheck({
      checked: catalog.length,
      matched,
      missing: missingProducts,
      ratios: [],
      findings: unmatched,
      snapshot,
      baseline: true,
      facts,
    });
  }
  const findings: PriceWatchFinding[] = [...unmatched];
  const ratios: number[] = [];
  for (const [key, now] of Object.entries(snapshot)) {
    const before = previous[key];
    if (!before) continue;
    ratios.push(now / before);
    const change = compareSupplierChange({ before, now, currency });
    const label = labels.get(key);
    if (change && label) {
      findings.push({
        kind: change.kind,
        sku: label.sku,
        title: label.title,
        url: label.url,
        currency: "USD",
        ours: label.ours,
        before,
        now,
        supplierCurrency: currency,
        deltaPct: change.deltaPct,
      });
    }
  }
  return finishPriceWatchCheck({
    checked: catalog.length,
    matched,
    missing: missingProducts,
    ratios,
    findings,
    snapshot,
    facts,
  });
}

/** Dinan / APR: weight and MSRP from the dealer price list kept at import; no request. */
async function checkImportFacts(def: PriceWatchSourceDefinition, ctx: PriceWatchContext) {
  const namespace = `${def.key}_import`;
  const catalog = await loadPriceWatchCatalog(ctx.client, def.brands, [namespace]);
  const facts: PriceWatchFact[] = [];
  for (const product of catalog) {
    const rows = parseJsonValue<
      Array<{ sku?: string; mapUsd?: number; msrpUsd?: number; weightLb?: number }>
    >(product.meta.pricing);
    const url = typeof product.meta.official_url === "string" ? product.meta.official_url : null;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row.sku) continue;
      const variant = product.variants.find(
        (entry) => normalizeSku(entry.sku) === normalizeSku(row.sku)
      );
      const weightLb = Number(row.weightLb);
      facts.push({
        supplierKey: normalizeSku(row.sku),
        productId: product.id,
        variantId: variant?.id ?? null,
        sku: variant?.sku ?? row.sku,
        supplierSku: row.sku,
        title: product.title,
        url,
        // The formula's base (Ігор, 21.10.2026): MAP, or MSRP for a SKU without MAP.
        price:
          Number(row.mapUsd) > 0
            ? Number(row.mapUsd)
            : Number(row.msrpUsd) > 0
              ? Number(row.msrpUsd)
              : null,
        currency: "USD",
        available: null,
        availability: null,
        weightKg: weightLb > 0 ? Math.round(weightLb * 453.59237) / 1000 : null,
      });
    }
  }
  return finishPriceWatchCheck({
    checked: catalog.length,
    matched: facts.length,
    missing: 0,
    ratios: [],
    findings: [],
    facts,
  });
}

/** Our price in hryvnias as the storefront shows it: native price through the price book. */
export function ourUahPrice(
  product: Pick<
    PriceWatchCatalogProduct,
    "priceEur" | "priceUsd" | "priceUah" | "priceSourceCurrency"
  >,
  variant: Pick<
    PriceWatchCatalogVariant,
    "priceEur" | "priceUsd" | "priceUah" | "priceSourceCurrency"
  > | null,
  rates: ShopPriceBookRates
) {
  const own =
    variant && (variant.priceEur || variant.priceUsd || variant.priceUah) ? variant : product;
  const source = own.priceSourceCurrency;
  try {
    return repriceShopSourceMoney(
      {
        eur: own.priceEur ?? 0,
        usd: own.priceUsd ?? 0,
        uah: own.priceUah ?? 0,
        ...(source === "EUR" || source === "USD" || source === "UAH"
          ? { sourceCurrency: source }
          : {}),
      },
      rates
    ).uah;
  } catch {
    return own.priceUah ?? null;
  }
}

async function loadPriceBookRates(ctx: PriceWatchContext) {
  const settings = await ctx.client.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  return normalizeShopCurrencyRates(settings?.currencyRates);
}

/** We are dearer than the competitor beyond 1 % and 200 ₴. */
export function compareWithCompetitor(oursUah: number | null, theirsUah: number) {
  if (!oursUah || !(theirsUah > 0)) return null;
  const difference = oursUah - theirsUah;
  if (difference < Math.max(200, theirsUah * PRICE_WATCH_MIN_SHARE)) return null;
  return { deltaPct: round1((difference / theirsUah) * 100) };
}

/** Atomic sells the brands we price from it; a stronger euro can make us dearer. */
const ATOMIC_COMPETITOR_COLLECTIONS = [
  { handle: "akrapovic", brand: "AKRAPOVIC" },
  { handle: "akrapovic-moto", brand: "AKRAPOVIC" },
  { handle: "ohlins", brand: "OHLINS" },
  { handle: "csf", brand: "CSF" },
  { handle: "adro", brand: "ADRO" },
  { handle: "girodisc", brand: "GiroDisc" },
] as const;

async function checkCompetitorAtomic(def: PriceWatchSourceDefinition, ctx: PriceWatchContext) {
  const rates = await loadPriceBookRates(ctx);
  const brands = [...new Set(ATOMIC_COMPETITOR_COLLECTIONS.map((entry) => entry.brand))];
  const catalog = await loadPriceWatchCatalog(ctx.client, brands);
  const ours = new Map<
    string,
    { product: PriceWatchCatalogProduct; variant: PriceWatchCatalogVariant | null }
  >();
  for (const product of catalog) {
    for (const variant of product.variants.length ? product.variants : [null]) {
      const sku = variant?.sku ?? product.sku;
      if (sku)
        ours.set(`${String(product.brand).toLowerCase()}\u0000${normalizeSku(sku)}`, {
          product,
          variant,
        });
    }
  }
  const facts: PriceWatchFact[] = [];
  const findings: PriceWatchFinding[] = [];
  const seen = new Set<string>();
  let failedCollections = 0;
  for (const collection of ATOMIC_COMPETITOR_COLLECTIONS) {
    let feed: ShopifyFeedProduct[];
    try {
      feed = await fetchShopifyFeed(ctx, {
        base: "https://atomic-shop.ua",
        collection: collection.handle,
      });
    } catch (error) {
      // One empty or moved collection must not hide the others.
      failedCollections += 1;
      if (failedCollections === ATOMIC_COMPETITOR_COLLECTIONS.length) throw error;
      continue;
    }
    for (const product of feed) {
      for (const variant of product.variants) {
        const key = `${collection.brand.toLowerCase()}\u0000${normalizeSku(variant.sku)}`;
        const hit = variant.sku ? ours.get(key) : undefined;
        const price = shopifyRegularPrice(variant);
        if (!hit || !(price > 0) || seen.has(key)) continue;
        seen.add(key);
        const sku = hit.variant?.sku ?? hit.product.sku ?? "";
        const url = `https://atomic-shop.ua/products/${encodeURIComponent(product.handle)}`;
        facts.push({
          supplierKey: `v${variant.id}`,
          productId: hit.product.id,
          variantId: hit.variant?.id ?? null,
          sku,
          supplierSku: variant.sku ?? null,
          title: hit.product.title,
          url,
          price,
          currency: "UAH",
          available: variant.available ?? null,
          availability: null,
          weightKg: null,
        });
        const oursUah = ourUahPrice(hit.product, hit.variant, rates);
        const dearer = compareWithCompetitor(oursUah, price);
        if (dearer) {
          findings.push({
            kind: "competitor",
            sku,
            title: hit.product.title,
            url,
            currency: "UAH",
            ours: oursUah === null ? null : round2(oursUah),
            now: price,
            supplierCurrency: "UAH",
            deltaPct: dearer.deltaPct,
          });
        }
      }
    }
    await pause(ctx, ctx.delayMs);
  }
  return finishPriceWatchCheck({
    checked: seen.size,
    matched: seen.size,
    missing: 0,
    ratios: [],
    findings,
    facts,
  });
}

const ADRENALIN_SITEMAP = "https://shop.a-drive.com.ua/sitemap_uk.xml";
/**
 * Brands Adrenalin Drive also sells (21.10.2026: ~940 pages). Its product URL
 * slugs start with the brand: "/products/dinan-…".
 */
const ADRENALIN_BRANDS = [
  { slug: "akrapovic", brand: "AKRAPOVIC" },
  { slug: "bmc", brand: "BMC" },
  { slug: "bootmod3", brand: "BootMod3" },
  { slug: "csf", brand: "CSF" },
  { slug: "adro", brand: "ADRO" },
  { slug: "dinan", brand: "Dinan" },
  { slug: "do88", brand: "DO88" },
  { slug: "eventuri", brand: "Eventuri" },
  { slug: "fi-exhaust", brand: "Fi EXHAUST" },
  { slug: "garrett", brand: "Garrett" },
  { slug: "girodisc", brand: "GiroDisc" },
  { slug: "kw", brand: "KW Suspensions" },
  { slug: "link", brand: "Link ECU" },
  { slug: "mst", brand: "MST Performance" },
  { slug: "ohlins", brand: "OHLINS" },
] as const;

/** Competitor pages one by one; the match is the manufacturer part number (mpn). */
async function stepCompetitorAdrenalin(
  def: PriceWatchSourceDefinition,
  ctx: PriceWatchContext,
  progress: PriceWatchProgress | null
): Promise<PriceWatchStep> {
  const sitemap = await fetchSupplier(ctx, ADRENALIN_SITEMAP, "application/xml");
  if (!sitemap) throw new PriceWatchFetchError(404, ADRENALIN_SITEMAP);
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => ADRENALIN_BRANDS.some(({ slug }) => url.includes(`/products/${slug}-`)))
    .sort();
  if (!urls.length) throw new Error("shop.a-drive.com.ua sitemap lists no products of our brands");
  const [rates, catalog] = await Promise.all([
    loadPriceBookRates(ctx),
    loadPriceWatchCatalog(
      ctx.client,
      ADRENALIN_BRANDS.map(({ brand }) => brand)
    ),
  ]);
  const ours = new Map<
    string,
    { product: PriceWatchCatalogProduct; variant: PriceWatchCatalogVariant | null }
  >();
  for (const product of catalog) {
    for (const variant of product.variants) {
      if (variant.sku) ours.set(competitorSkuKey(variant.sku), { product, variant });
    }
    if (product.sku && !ours.has(competitorSkuKey(product.sku))) {
      ours.set(competitorSkuKey(product.sku), { product, variant: null });
    }
  }
  const state = progress ?? newProgress(ctx.now);
  const facts: PriceWatchFact[] = [];
  let pages = 0;
  while (state.offset < urls.length) {
    if (pages >= (def.pagesPerRun ?? 50) || Date.now() > ctx.deadline) {
      return { done: false, progress: state, facts };
    }
    const url = urls[state.offset];
    state.offset += 1;
    pages += 1;
    let html: string | null;
    try {
      const response = await fetchSupplier(ctx, url, "text/html");
      html = response ? await response.text() : null;
      state.failedInRow = 0;
    } catch (error) {
      state.failedInRow = (state.failedInRow ?? 0) + 1;
      if (state.failedInRow >= 8) throw error;
      state.failed = (state.failed ?? 0) + 1;
      continue;
    }
    await pause(ctx, ctx.delayMs);
    const offer = html ? extractJsonLdProductPrice(html) : null;
    const hit = offer?.mpn ? ours.get(competitorSkuKey(offer.mpn)) : undefined;
    if (!offer || !hit) continue;
    state.checked += 1;
    state.matched += 1;
    const sku = hit.variant?.sku ?? hit.product.sku ?? offer.mpn ?? "";
    const stockState = readSchemaAvailability(offer.availability);
    facts.push({
      supplierKey: url,
      productId: hit.product.id,
      variantId: hit.variant?.id ?? null,
      sku,
      supplierSku: offer.mpn,
      title: hit.product.title,
      url,
      price: offer.price,
      currency: "UAH",
      available: stockState.available,
      availability: stockState.text,
      weightKg: null,
    });
    const oursUah = ourUahPrice(hit.product, hit.variant, rates);
    const dearer = offer.currency === "UAH" ? compareWithCompetitor(oursUah, offer.price) : null;
    if (dearer) {
      state.findings.push({
        kind: "competitor",
        sku,
        title: hit.product.title,
        url,
        currency: "UAH",
        ours: oursUah === null ? null : round2(oursUah),
        now: offer.price,
        supplierCurrency: "UAH",
        deltaPct: dearer.deltaPct,
      });
    }
  }
  return {
    done: true,
    result: finishPriceWatchCheck({
      checked: state.checked,
      matched: state.matched,
      missing: 0,
      ratios: [],
      findings: state.findings,
      summary: { failedPages: state.failed ?? 0 },
      facts,
    }),
  };
}

/** Part numbers compared without case, spaces or dashes ("D650 0010" = "d650-0010"). */
export function competitorSkuKey(value: string) {
  return value.toUpperCase().replace(/[\s\-_./]+/g, "");
}

/** Prices of these brands follow the Atomic feed every 3 hours; watch the sync itself. */
async function checkAtomicSync(ctx: PriceWatchContext): Promise<PriceWatchCheckResult> {
  const since = new Date(ctx.now.getTime() - 24 * 60 * 60 * 1000);
  const select = { createdAt: true, metadata: true } as const;
  const runs = await ctx.client.adminAuditLog.findMany({
    where: { entityType: "AtomicPriceSync", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select,
  });
  const last =
    runs[0] ??
    (await ctx.client.adminAuditLog.findFirst({
      where: { entityType: "AtomicPriceSync" },
      orderBy: { createdAt: "desc" },
      select,
    }));
  const metadata = (value: unknown) =>
    (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const updated = runs.reduce(
    (sum, run) => sum + (Number(metadata(run.metadata).updatedProductCount) || 0),
    0
  );
  const failed = runs.reduce(
    (sum, run) => sum + (Number(metadata(run.metadata).failedCount) || 0),
    0
  );
  const hoursSinceLast = last
    ? Math.round(((ctx.now.getTime() - last.createdAt.getTime()) / 3_600_000) * 10) / 10
    : null;
  const atomic = {
    runs: runs.length,
    lastAt: last?.createdAt.toISOString() ?? null,
    hoursSinceLast,
    updated,
    failed,
  };
  const error =
    hoursSinceLast === null
      ? "синхронизация Atomic ещё ни разу не запускалась"
      : hoursSinceLast > 8
        ? `синхронизация Atomic не запускалась ${Math.floor(hoursSinceLast)} ч`
        : failed > 0
          ? `за сутки не обновились ${failed} товаров`
          : null;
  return {
    status: error ? "error" : "ok",
    checked: 0,
    findings: [],
    summary: { atomic, ...(error ? { error } : {}) },
  };
}

/** GBP/USD fixed inside formulas against the NBU cross rate of today. */
async function checkFormulaFx(ctx: PriceWatchContext): Promise<PriceWatchCheckResult> {
  const rate = async (code: "GBP" | "USD") => {
    const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${code}&json`;
    const response = await fetchSupplier(ctx, url, "application/json");
    const body = response
      ? ((await response.json()) as Array<{ rate?: number; exchangedate?: string }>)
      : [];
    const entry = Array.isArray(body) ? body[0] : null;
    const value = Number(entry?.rate);
    if (!(value > 0)) throw new Error(`NBU has no ${code} rate`);
    return { value, date: String(entry?.exchangedate ?? "") };
  };
  const gbp = await rate("GBP");
  const usd = await rate("USD");
  const gbpUsd = Math.round((gbp.value / usd.value) * 10_000) / 10_000;
  const formulas = PRICE_WATCH_FORMULA_FX.map((entry) => ({
    source: entry.source,
    gbpUsd: entry.gbpUsd,
    driftPct: round1((gbpUsd / entry.gbpUsd - 1) * 100),
  }));
  const findings: PriceWatchFinding[] = formulas
    .filter((entry) => Math.abs(entry.driftPct) >= PRICE_WATCH_FX_ALERT_PCT)
    .map((entry) => ({
      kind: "fx",
      sku: entry.source,
      title: entry.source,
      currency: "USD",
      expected: entry.gbpUsd,
      now: gbpUsd,
      deltaPct: entry.driftPct,
    }));
  return {
    status: findings.length ? "findings" : "ok",
    checked: 0,
    findings,
    summary: { fx: { date: gbp.date, gbpUsd, formulas } },
  };
}

/** One step of a check: feeds finish at once, page sources may continue next run. */
export async function runPriceWatchStep(
  def: PriceWatchSourceDefinition,
  ctx: PriceWatchContext,
  progress: PriceWatchProgress | null
): Promise<PriceWatchStep> {
  switch (def.check) {
    case "ct-carbon":
      return { done: true, result: await checkCtCarbon(def, ctx) };
    case "link-ecu":
      return { done: true, result: await checkLinkEcu(def, ctx) };
    case "brabus":
      return stepBrabus(def, ctx, progress);
    case "mst":
      return stepMst(def, ctx, progress);
    case "shopify-changes":
      return { done: true, result: await checkShopifyChanges(def, ctx) };
    case "atomic":
      return { done: true, result: await checkAtomicSync(ctx) };
    case "import-facts":
      return { done: true, result: await checkImportFacts(def, ctx) };
    case "competitor-atomic":
      return { done: true, result: await checkCompetitorAtomic(def, ctx) };
    case "competitor-adrenalin":
      return stepCompetitorAdrenalin(def, ctx, progress);
    case "fx":
      return { done: true, result: await checkFormulaFx(ctx) };
    default:
      throw new Error(`${def.key} has no automatic check`);
  }
}

/** Reads a stored progress object back; anything malformed starts the check over. */
export function parsePriceWatchProgress(value: unknown): PriceWatchProgress | null {
  const record = (value && typeof value === "object" ? value : null) as Record<
    string,
    unknown
  > | null;
  if (
    !record ||
    typeof record.startedAt !== "string" ||
    !Number.isInteger(record.offset) ||
    !Array.isArray(record.findings) ||
    !Array.isArray(record.ratios)
  ) {
    return null;
  }
  return {
    startedAt: record.startedAt,
    offset: Number(record.offset),
    checked: Number(record.checked) || 0,
    matched: Number(record.matched) || 0,
    missing: Number(record.missing) || 0,
    noPrice: Number(record.noPrice) || 0,
    failed: Number(record.failed) || 0,
    failedInRow: Number(record.failedInRow) || 0,
    pauses: Number(record.pauses) || 0,
    ratios: (record.ratios as unknown[]).map(Number).filter(Number.isFinite),
    findings: record.findings as PriceWatchFinding[],
  };
}

export const PRICE_WATCH_MAX_PAUSES = 3;

/**
 * A page check whose site stopped answering (or started refusing) keeps its
 * progress, and the next hourly run continues from the same page; the third
 * stop in a row ends the check as an error. Null: record the error now.
 */
export function pausePriceWatchProgress(
  def: Pick<PriceWatchSourceDefinition, "pagesPerRun">,
  progress: PriceWatchProgress | null
): PriceWatchProgress | null {
  if (!progress || !def.pagesPerRun) return null;
  const pauses = (progress.pauses ?? 0) + 1;
  return pauses < PRICE_WATCH_MAX_PAUSES ? { ...progress, failedInRow: 0, pauses } : null;
}
