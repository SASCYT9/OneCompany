import "server-only";

import type { Metadata } from "next";
import { buildPageMetadata, type SupportedLocale } from "@/lib/seo";
import {
  buildShopCatalogLandingCopy,
  shopCatalogLandingFilters,
  shopCatalogLandingQuery,
  shopCatalogLandingStatsFromResponse,
  type ShopCatalogLanding,
  type ShopCatalogLandingStats,
} from "@/lib/shopCatalogLandings";
import type { StockPageSearchParams } from "@/lib/shopStockInitialSearch";
import { readGuestCatalogSearch } from "@/lib/shopStockGuestInitialData.server";

/** Live counts for a landing page; `null` when the catalog search is unavailable. */
export async function loadShopCatalogLandingStats(
  locale: SupportedLocale,
  landing: ShopCatalogLanding
): Promise<ShopCatalogLandingStats | null> {
  try {
    const response = await readGuestCatalogSearch(locale, shopCatalogLandingFilters(landing));
    return shopCatalogLandingStatsFromResponse(response);
  } catch (error) {
    console.error({
      event: "catalog_landing_stats_failed",
      path: landing.path,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

export async function buildShopCatalogLandingMetadata(
  locale: SupportedLocale,
  landing: ShopCatalogLanding,
  searchParams: StockPageSearchParams
): Promise<Metadata> {
  const { page, filtered } = shopCatalogLandingQuery(searchParams);
  const copy = buildShopCatalogLandingCopy(
    locale,
    landing,
    await loadShopCatalogLandingStats(locale, landing)
  );
  const paged = !filtered && page > 1;
  const slug = `shop/${landing.path}${paged ? `?page=${page}` : ""}`;
  const title = paged
    ? copy.title.replace(
        / \| One Company$/,
        `${locale === "ua" ? ` — сторінка ${page}` : ` — page ${page}`} | One Company`
      )
    : copy.title;
  const metadata = buildPageMetadata(locale, slug, { title, description: copy.description });
  return filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}
