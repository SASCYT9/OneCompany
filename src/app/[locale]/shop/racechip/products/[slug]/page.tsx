import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import { localizeShopDescription, localizeShopProductTitle } from '@/lib/shopText';
import {
  extractProductFitment,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from '@/lib/crossShopFitment';
import CrossShopFitment from '../../../components/CrossShopFitment';
import RacechipShopProductDetailLayout from '../../../components/RacechipShopProductDetailLayout';

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = 'force-static';
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

  const [settingsRecord, allProducts] = await Promise.all([    getOrCreateShopSettings(prisma),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  // Cross-shop fitment matches: parts from other stores that fit the same
  // vehicle as this RaceChip module. RaceChip products are tag-driven
  // (`car_make:bmw`, `car_model:m340i`) so the unified fitment extractor
  // picks them up via the generic tag fallback.
  const crossShopFitment =
    product && !isExcludedFromCrossShop(product)
      ? extractProductFitment(product)
      : null;
  const crossShopGroups =
    product && crossShopFitment && (crossShopFitment.make || crossShopFitment.chassisCodes.length > 0)
      ? findCrossShopFitmentMatches(product, allProducts, {
          perBrand: 3,
          totalLimit: 9,
        })
      : [];

  return (
    <>
      <RacechipShopProductDetailLayout
        locale={resolvedLocale}
        product={product}
        viewerContext={viewerContext}
      />
      {crossShopFitment && crossShopGroups.length > 0 ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <CrossShopFitment
            locale={resolvedLocale}
            fitment={crossShopFitment}
            groups={crossShopGroups}
          />
        </div>
      ) : null}
    </>
  );
}
