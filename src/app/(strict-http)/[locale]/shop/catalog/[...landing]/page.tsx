import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import ShopCatalogLandingView from "@/components/shop/ShopCatalogLandingView";
import { resolveLocale } from "@/lib/seo";
import {
  findNearestShopCatalogLanding,
  findShopCatalogLanding,
  shopCatalogLandingHref,
} from "@/lib/shopCatalogLandings";
import { buildShopCatalogLandingMetadata } from "@/lib/shopCatalogLandings.server";
import type { StockPageSearchParams } from "@/lib/shopStockInitialSearch";

type Props = {
  params: Promise<{ locale: string; landing: string[] }>;
  searchParams: Promise<StockPageSearchParams>;
};

const landingPath = (segments: string[]) => `catalog/${segments.join("/")}`;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, landing: segments }, query] = await Promise.all([params, searchParams]);
  const landing = findShopCatalogLanding(landingPath(segments));
  if (!landing) return {};
  return buildShopCatalogLandingMetadata(resolveLocale(locale), landing, query);
}

/**
 * Vehicle make, model and make × category landing pages of the general
 * catalog (`/shop/catalog/bmw`, `/shop/catalog/bmw/m3`,
 * `/shop/catalog/bmw/exhaust`). A combination below the product threshold
 * redirects to its nearest landing page.
 */
export default async function ShopCatalogLandingPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, landing: segments }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale = resolveLocale(rawLocale);
  const path = landingPath(segments);
  const landing = findShopCatalogLanding(path);
  if (!landing) {
    const parent = findNearestShopCatalogLanding(path);
    if (parent) permanentRedirect(shopCatalogLandingHref(locale, parent));
    notFound();
  }
  return <ShopCatalogLandingView locale={locale} landing={landing} searchParams={query} />;
}
