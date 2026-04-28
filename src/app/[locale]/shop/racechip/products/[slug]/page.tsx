import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import {
  extractProductFitment,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from '@/lib/crossShopFitment';
import CrossShopFitment from '../../../components/CrossShopFitment';
import RacechipShopProductDetailLayout from '../../../components/RacechipShopProductDetailLayout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const p = await prisma.shopProduct.findUnique({ where: { slug } });
  if (!p) return {};

  const title = resolvedLocale === 'ua' && p.titleUa ? p.titleUa : p.titleEn;
  return buildPageMetadata(resolvedLocale, `shop/racechip/products/${slug}`, {
    title: `${title} | RaceChip Ukraine`,
    description: `Buy ${title} tuning module. Maximum performance and efficiency with RaceChip app control.`,
    image: p.image || undefined,
  });
}

export default async function RacechipProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  const product = await prisma.shopProduct.findUnique({
    where: { slug, status: 'ACTIVE' },
    include: { variants: true },
  });

  if (!product) {
    redirect(`/${resolvedLocale}/shop/racechip`);
  }

  const [session, settingsRecord, catalogProduct, allProducts] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
    getShopProductBySlugServer(slug),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );

  // Cross-shop fitment matches: parts from other stores that fit the same
  // vehicle as this RaceChip module. RaceChip products are tag-driven
  // (`car_make:bmw`, `car_model:m340i`) so the unified fitment extractor
  // picks them up via the generic tag fallback.
  const crossShopFitment =
    catalogProduct && !isExcludedFromCrossShop(catalogProduct)
      ? extractProductFitment(catalogProduct)
      : null;
  const crossShopGroups =
    catalogProduct && crossShopFitment && (crossShopFitment.make || crossShopFitment.chassisCodes.length > 0)
      ? findCrossShopFitmentMatches(catalogProduct, allProducts, {
          perBrand: 3,
          totalLimit: 9,
        })
      : [];

  return (
    <>
      <RacechipShopProductDetailLayout
        locale={resolvedLocale}
        product={JSON.parse(JSON.stringify(product))}
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
