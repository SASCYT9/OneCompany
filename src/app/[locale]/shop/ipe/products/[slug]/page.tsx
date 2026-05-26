import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveLocale, type SupportedLocale } from "@/lib/seo";
import {
  getShopProductBySlugServer,
  getShopProductsServer,
  getTopProductSlugsByBrand,
} from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  extractProductFitment,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from "@/lib/crossShopFitment";
import type { ShopProduct } from "@/lib/shopCatalog";
import CrossShopFitment from "../../../components/CrossShopFitment";
import { getShopProductPageMetadata } from "../../../components/ShopProductDetailPage";
import { IpeShopProductDetailLayout } from "../../../components/IpeShopProductDetailLayout";
import { ShopProductStructuredData } from "@/components/seo/StructuredData";

// ISR: cache rendered HTML. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getTopProductSlugsByBrand("iPE exhaust", 25);
  const params = [];
  for (const slug of slugs) {
    params.push({ locale: "ua", slug });
    params.push({ locale: "en", slug });
  }
  return params;
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({
    locale: resolveLocale(locale),
    slug,
    mode: "ipe",
  });
}

export default async function IpeProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  // Main PDP path: only product + settings (avoid full-catalog fetch).
  // Cross-shop suggestions stream below via Suspense.
  const [product, settingsRecord] = await Promise.all([
    getShopProductBySlugServer(slug),
    getOrCreateShopSettings(prisma),
  ]);
  if (!product) notFound();
  const settings = getShopSettingsRuntime(settingsRecord);
  const rates = settings.currencyRates;
  // ISR-cached: anonymous viewer context. Logged-in B2B sees their discount via
  // `useShopViewerContext` on the client side; this ensures the price band
  // component still has a valid baseline pricing object on initial paint.
  const viewerContext = buildShopViewerPricingContext(settings, null, false, null);
  const pricing = resolveShopProductPricing(product, viewerContext);

  return (
    <>
      <ShopProductStructuredData product={product} locale={resolvedLocale} rates={rates} />
      <IpeShopProductDetailLayout
        locale={resolvedLocale}
        resolvedLocale={resolvedLocale}
        product={product}
        pricing={pricing}
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
