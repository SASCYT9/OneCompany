/**
 * GET /api/shop/feed/products
 * Google Merchant Center product feed (RSS 2.0 + g: namespace).
 * Query: locale=ua|en (default: en), currency=EUR|USD|UAH (default: EUR).
 *
 * In Merchant Center: Products → Feeds → Add feed → Scheduled fetch → enter this URL.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import type { ShopProduct } from "@/lib/shopCatalog";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { siteConfig } from "@/lib/seo";
import { buildMerchantFeedItemXml, escapeXml } from "@/lib/shopMerchantFeed";

export async function GET(request: NextRequest) {
  const locale =
    (request.nextUrl.searchParams.get("locale") || "en").toLowerCase() === "ua" ? "ua" : "en";
  const currencyParam = (request.nextUrl.searchParams.get("currency") || "EUR").toUpperCase();
  const currency: "EUR" | "USD" | "UAH" =
    currencyParam === "UAH" ? "UAH" : currencyParam === "USD" ? "USD" : "EUR";

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

  const itemsXml = products
    .filter(
      (p) =>
        p.image &&
        ((p.price?.eur ?? 0) > 0 ||
          (p.price?.usd ?? 0) > 0 ||
          (p.price?.uah ?? 0) > 0 ||
          (p.variants?.some(
            (v) => (v.price?.eur ?? 0) > 0 || (v.price?.usd ?? 0) > 0 || (v.price?.uah ?? 0) > 0
          ) ??
            false))
    )
    .map((p) => buildMerchantFeedItemXml(p, locale, currency, rates))
    .filter(Boolean)
    .join("\n");

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
