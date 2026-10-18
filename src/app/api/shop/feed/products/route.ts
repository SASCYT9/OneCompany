/**
 * GET /api/shop/feed/products
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 * Query: locale=ua|en (default: ua), currency=UAH|EUR|USD (default: UAH for ua, EUR for en),
 * set=core (optional) with limit=N (default 150): a short feed for a small product limit —
 * warehouse-confirmed items first, then curated brands in turn
 * (https://onecompany.global/api/shop/feed/products?locale=ua&currency=UAH&set=core).
 *
 * In Merchant Center (target country Ukraine): Products → Feeds → Add feed →
 * Scheduled fetch → https://onecompany.global/api/shop/feed/products?locale=ua&currency=UAH
 * robots.txt allows this path for Googlebot (src/app/robots.ts).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import type { ShopProduct } from "@/lib/shopCatalog";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { siteConfig } from "@/lib/seo";
import {
  buildMerchantFeedIds,
  buildMerchantFeedItemXml,
  escapeXml,
  MERCHANT_CORE_FEED_DEFAULT_LIMIT,
  MERCHANT_CORE_FEED_MAX_LIMIT,
  selectMerchantCoreProducts,
} from "@/lib/shopMerchantFeed";

export async function GET(request: NextRequest) {
  const locale =
    (request.nextUrl.searchParams.get("locale") || "ua").toLowerCase() === "en" ? "en" : "ua";
  const currencyParam = (
    request.nextUrl.searchParams.get("currency") || (locale === "ua" ? "UAH" : "EUR")
  ).toUpperCase();
  const currency: "EUR" | "USD" | "UAH" =
    currencyParam === "UAH" ? "UAH" : currencyParam === "USD" ? "USD" : "EUR";
  const coreSet = request.nextUrl.searchParams.get("set") === "core";
  const requestedLimit = Math.floor(Number(request.nextUrl.searchParams.get("limit")));
  const coreLimit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MERCHANT_CORE_FEED_MAX_LIMIT)
      : MERCHANT_CORE_FEED_DEFAULT_LIMIT;

  let products: ShopProduct[];
  let rates: Record<"EUR" | "USD" | "UAH", number>;
  try {
    const [productsResult, settingsRecord] = await Promise.all([
      getShopProductsServer(),
      getOrCreateShopSettings(prisma),
    ]);
    products = productsResult;
    rates = getShopSettingsRuntime(settingsRecord).currencyRates;
  } catch (e) {
    console.error("Shop feed: failed to load products", e);
    return new Response("Failed to generate feed", { status: 500 });
  }

  const listable = products.filter(
    (p) =>
      p.image &&
      ((p.price?.eur ?? 0) > 0 ||
        (p.price?.usd ?? 0) > 0 ||
        (p.price?.uah ?? 0) > 0 ||
        (p.variants?.some(
          (v) => (v.price?.eur ?? 0) > 0 || (v.price?.usd ?? 0) > 0 || (v.price?.uah ?? 0) > 0
        ) ??
          false))
  );
  // Merchant Center keeps only one item per g:id, so a repeated ID silently
  // drops products. IDs are unique by construction; the guard only logs.
  // They are built over the whole catalogue, so a product keeps the same ID
  // in the full and in the core feed.
  const ids = buildMerchantFeedIds(listable);
  const idByProduct = new Map(listable.map((product, index) => [product, ids[index]]));
  const selected = coreSet ? selectMerchantCoreProducts(listable, coreLimit) : listable;
  const seenIds = new Set<string>();
  const items: string[] = [];
  selected.forEach((product) => {
    const id = idByProduct.get(product)!;
    if (seenIds.has(id)) {
      console.warn("Shop feed: duplicate g:id skipped", { id, slug: product.slug });
      return;
    }
    const itemXml = buildMerchantFeedItemXml(product, locale, currency, rates, { id });
    if (!itemXml) return;
    seenIds.add(id);
    items.push(itemXml);
  });
  const itemsXml = items.join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml("One Company Shop – Products")}</title>
    <link>${escapeXml(siteConfig.url)}</link>
    <description>Product feed for Google Merchant Center</description>
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    },
  });
}
