import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { resolveLocale } from '@/lib/seo';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';
import {
  extractProductFitment,
  findCrossShopFitmentMatches,
  isExcludedFromCrossShop,
} from '@/lib/crossShopFitment';
import CrossShopFitment from '../../../components/CrossShopFitment';
import { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';
import { IpeShopProductDetailLayout } from '../../../components/IpeShopProductDetailLayout';
import { ShopProductStructuredData } from '@/components/seo/StructuredData';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = 'force-static';
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({
    locale: resolveLocale(locale),
    slug,
    mode: 'ipe',
  });
}

export default async function IpeProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const [product, allProducts, settingsRecord] = await Promise.all([
    getShopProductBySlugServer(slug),
    getShopProductsServer(),
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

  const crossShopFitment =
    !isExcludedFromCrossShop(product) ? extractProductFitment(product) : null;
  const crossShopGroups =
    crossShopFitment && (crossShopFitment.make || crossShopFitment.chassisCodes.length > 0)
      ? findCrossShopFitmentMatches(product, allProducts, {
          perBrand: 3,
          totalLimit: 9,
        })
      : [];

  return (
    <>
      <ShopProductStructuredData product={product} locale={resolvedLocale} rates={rates} />
      <IpeShopProductDetailLayout
        locale={resolvedLocale}
        resolvedLocale={resolvedLocale}
        product={product}
        pricing={pricing}
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
