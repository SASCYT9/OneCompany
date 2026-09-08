import { DeferredCrossShopFitment } from "@/components/shop/DeferredCrossShopFitment";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import {
  getRacechipProductBySlugLightServer,
  getTopProductSlugsByBrand,
} from "@/lib/shopCatalogServer";
import { localizeShopDescription, localizeShopProductTitle } from "@/lib/shopText";
import { extractProductFitment, isExcludedFromCrossShop } from "@/lib/crossShopFitment";
import type { ShopProduct } from "@/lib/shopCatalog";
import RacechipShopProductDetailLayout from "@/app/[locale]/shop/components/RacechipShopProductDetailLayout";
import { requireCanonicalStorefrontProduct } from "@/app/[locale]/shop/components/ShopProductDetailPage";
import { ShopProductStructuredData } from "@/components/seo/StructuredData";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getTopProductSlugsByBrand("racechip", 25);
  const params = [];
  for (const slug of slugs) {
    params.push({ locale: "ua", slug });
    params.push({ locale: "en", slug });
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const product =
    (await getRacechipProductBySlugLightServer(slug)) ??
    (await requireCanonicalStorefrontProduct({ locale: resolvedLocale, slug, mode: "racechip" }));

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

  const product =
    (await getRacechipProductBySlugLightServer(slug)) ??
    (await requireCanonicalStorefrontProduct({ locale: resolvedLocale, slug, mode: "racechip" }));

  // Recommendations load near the viewport, outside the ISR render.
  const settingsRuntime = await getPublicShopSettingsRuntime();
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
      <CrossShopFitmentSection product={product} locale={resolvedLocale} />
    </>
  );
}

function CrossShopFitmentSection({
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
  return <DeferredCrossShopFitment slug={product.slug} locale={locale} />;
}
