import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { getShopProductBySlugServer, getShopProductsServer } from "@/lib/shopCatalogServer";
import { localizeShopDescription, localizeShopProductTitle } from "@/lib/shopText";
import {
  extractProductFitment,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from "@/lib/crossShopFitment";
import type { ShopProduct } from "@/lib/shopCatalog";
import CrossShopFitment from "../../../components/CrossShopFitment";
import RacechipShopProductDetailLayout from "../../../components/RacechipShopProductDetailLayout";
import { ShopProductStructuredData } from "@/components/seo/StructuredData";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const product = await getShopProductBySlugServer(slug);
  if (!product) return {};

  const title = localizeShopProductTitle(resolvedLocale, product);
  return buildPageMetadata(resolvedLocale, `shop/racechip/products/${slug}`, {
    title: `${title} | RaceChip Ukraine`,
    description:
      localizeShopDescription(resolvedLocale, product.shortDescription) ||
      `Buy ${title} tuning module. Maximum performance and efficiency with RaceChip app control.`,
    image: product.image || undefined,
    type: "product",
  });
}

export default async function RacechipProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  const product = await getShopProductBySlugServer(slug);

  if (!product) {
    redirect(`/${resolvedLocale}/shop/racechip`);
  }

  // Main PDP path: only fetch settings + product. The cross-shop lookup
  // (which iterates ~30k products in JS to find fitment matches) used to
  // block first paint by ~1 s; now it's deferred to a streaming Suspense
  // boundary so the product info renders immediately.
  const settingsRecord = await getOrCreateShopSettings(prisma);

  const settingsRuntime = getShopSettingsRuntime(settingsRecord);
  const viewerContext = buildShopViewerPricingContext(settingsRuntime, null, false, null);

  return (
    <>
      <ShopProductStructuredData
        product={product}
        locale={resolvedLocale}
        rates={settingsRuntime.currencyRates}
      />
      <RacechipShopProductDetailLayout
        locale={resolvedLocale}
        product={product}
        viewerContext={viewerContext}
      />
      <Suspense fallback={null}>
        <CrossShopFitmentSection product={product} locale={resolvedLocale} />
      </Suspense>
    </>
  );
}

async function CrossShopFitmentSection({
  product,
  locale,
}: {
  product: ShopProduct;
  locale: SupportedLocale;
}) {
  if (isExcludedFromCrossShop(product)) return null;
  const fitment = extractProductFitment(product);
  if (!fitment.make && fitment.chassisCodes.length === 0) return null;

  // Cross-shop iterates the full catalog. Streaming makes this non-blocking.
  const allProducts = await getShopProductsServer();
  const groups = findCrossShopFitmentMatches(product, allProducts, {
    perBrand: 3,
    totalLimit: 9,
  });
  if (!groups.length) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <CrossShopFitment locale={locale} fitment={fitment} groups={groups} />
    </div>
  );
}
