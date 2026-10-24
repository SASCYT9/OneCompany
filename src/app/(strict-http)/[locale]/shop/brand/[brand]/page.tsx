import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import ShopCatalogLandingView from "@/components/shop/ShopCatalogLandingView";
import { getBrandBySlug } from "@/lib/brands";
import { resolveLocale } from "@/lib/seo";
import { findShopCatalogLanding } from "@/lib/shopCatalogLandings";
import { buildShopCatalogLandingMetadata } from "@/lib/shopCatalogLandings.server";
import type { StockPageSearchParams } from "@/lib/shopStockInitialSearch";

type Props = {
  params: Promise<{ locale: string; brand: string }>;
  searchParams: Promise<StockPageSearchParams>;
};

function decodeBrandSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, brand }, query] = await Promise.all([params, searchParams]);
  const landing = findShopCatalogLanding(`brand/${brand}`);
  if (!landing) return {};
  return buildShopCatalogLandingMetadata(resolveLocale(locale), landing, query);
}

/**
 * Brands without a storefront of their own (Remus, KW, BMC…) get a catalog
 * landing page here. Other old generic brand URLs stay recoverable without
 * exposing a second brand page: they lead to the main catalog filter.
 */
export default async function ShopBrandLandingPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, brand: rawBrand }, query] = await Promise.all([params, searchParams]);
  const locale = resolveLocale(rawLocale);
  const landing = findShopCatalogLanding(`brand/${rawBrand}`);
  if (landing) {
    return <ShopCatalogLandingView locale={locale} landing={landing} searchParams={query} />;
  }

  const brand = decodeBrandSegment(rawBrand);
  if (!brand) notFound();
  // The catalog filters by the brand name: a slug ("ct-carbon") would match nothing.
  const name = getBrandBySlug(brand.toLowerCase())?.name ?? brand;
  permanentRedirect(`/${locale}/shop/catalog?brand=${encodeURIComponent(name)}`);
}
