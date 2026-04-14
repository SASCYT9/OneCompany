import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { localizeShopProductTitle } from '@/lib/shopText';
import { prisma } from '@/lib/prisma';
import { ADRO_PRODUCT_LINES } from '../../../data/adroHomeData';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getProductsForAdroCollection } from '@/lib/adroCollectionMatcher';
import AdroCollectionProductGrid from '../../../components/AdroCollectionProductGrid';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

export async function generateStaticParams() {
  return ADRO_PRODUCT_LINES.map((line) => ({ handle: line.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const line = ADRO_PRODUCT_LINES.find((l) => l.id === handle);
  const title = line
    ? `${resolvedLocale === 'ua' ? line.nameUk : line.name} | ADRO | One Company`
    : `${handle} | ADRO | One Company`;
  
  return buildPageMetadata(resolvedLocale, `shop/adro/collections/${handle}`, {
    title,
    description:
      resolvedLocale === 'ua'
        ? `Програма ADRO для ${line?.nameUk ?? handle}. Офіційний постачальник в Україні.`
        : `ADRO aerodynamic program for ${line?.name ?? handle}. Official supplier in Ukraine.`,
  });
}

export default async function AdroCollectionHandlePage({ params }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const line = ADRO_PRODUCT_LINES.find((l) => l.id === handle);

  const [session, settingsRecord, products] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );

  const collectionProducts = getProductsForAdroCollection(products, handle);

  // Sort: Full Kit first, then by price desc
  const sortedProducts = [...collectionProducts].sort((a, b) => {
    const titleA = localizeShopProductTitle(resolvedLocale, a).toLowerCase();
    const titleB = localizeShopProductTitle(resolvedLocale, b).toLowerCase();
    const isKitA = titleA.includes('kit') || titleA.includes('widebody') || titleA.includes('full body');
    const isKitB = titleB.includes('kit') || titleB.includes('widebody') || titleB.includes('full body');
    if (isKitA && !isKitB) return -1;
    if (!isKitA && isKitB) return 1;
    const priceA = a.price?.usd || a.price?.eur || a.price?.uah || 0;
    const priceB = b.price?.usd || b.price?.eur || b.price?.uah || 0;
    return priceB - priceA;
  });

  return (
    <>
      <AdroCollectionProductGrid
        locale={resolvedLocale}
        handle={handle}
        title={line ? (resolvedLocale === 'ua' ? line.nameUk : line.name) : handle}
        brand="ADRO Aero"
        products={sortedProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
