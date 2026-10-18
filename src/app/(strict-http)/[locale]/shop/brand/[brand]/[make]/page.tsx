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
  params: Promise<{ locale: string; brand: string; make: string }>;
  searchParams: Promise<StockPageSearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, brand, make }, query] = await Promise.all([params, searchParams]);
  const landing = findShopCatalogLanding(`brand/${brand}/${make}`);
  if (!landing) return {};
  return buildShopCatalogLandingMetadata(resolveLocale(locale), landing, query);
}

/** Brand × vehicle make landing pages (`/shop/brand/remus/bmw`). */
export default async function ShopBrandMakeLandingPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, brand, make }, query] = await Promise.all([params, searchParams]);
  const locale = resolveLocale(rawLocale);
  const path = `brand/${brand}/${make}`;
  const landing = findShopCatalogLanding(path);
  if (!landing) {
    const parent = findNearestShopCatalogLanding(path);
    if (parent) permanentRedirect(shopCatalogLandingHref(locale, parent));
    notFound();
  }
  return <ShopCatalogLandingView locale={locale} landing={landing} searchParams={query} />;
}
