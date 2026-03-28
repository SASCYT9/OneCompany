import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { BRABUS_COLLECTION_CARDS } from '../../../data/brabusCollectionsList';
import { getBrabusCollectionPageConfig } from '../../../data/brabusCollectionPages';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getProductsForBrabusCollection } from '@/lib/brabusCollectionMatcher';
import BrabusCollectionHero from '../../../components/BrabusCollectionHero';
import BrabusCollectionProductGrid from '../../../components/BrabusCollectionProductGrid';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

export async function generateStaticParams() {
  return BRABUS_COLLECTION_CARDS.map((card) => ({ handle: card.collectionHandle }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const card = BRABUS_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
  const config = getBrabusCollectionPageConfig(handle);
  const title = config
    ? `${resolvedLocale === 'ua' ? config.titleUk : config.title} | Brabus | One Company`
    : `${card?.title ?? handle} | Brabus | One Company`;
  return buildPageMetadata(resolvedLocale, `shop/brabus/collections/${handle}`, {
    title,
    description:
      resolvedLocale === 'ua'
        ? `Програма BRABUS ${config?.titleUk ?? card?.title ?? handle}. Офіційний постачальник в Україні.`
        : `BRABUS ${config?.title ?? card?.title ?? handle} programme. Official supplier in Ukraine.`,
  });
}

export default async function BrabusCollectionHandlePage({ params }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const config = getBrabusCollectionPageConfig(handle);
  const card = BRABUS_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);

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

  const collectionProducts = getProductsForBrabusCollection(products, handle);

  // Sort: Full Kit / Widetrack / Комплект first, then by price desc
  const sortedProducts = [...collectionProducts].sort((a, b) => {
    const titleA = (a.title?.en || '').toLowerCase();
    const titleB = (b.title?.en || '').toLowerCase();
    const isKitA = titleA.includes('full kit') || titleA.includes('widetrack') || titleA.includes('widebody') || titleA.includes('full body') || titleA.includes('body kit');
    const isKitB = titleB.includes('full kit') || titleB.includes('widetrack') || titleB.includes('widebody') || titleB.includes('full body') || titleB.includes('body kit');
    if (isKitA && !isKitB) return -1;
    if (!isKitA && isKitB) return 1;
    const priceA = a.price?.eur || a.price?.uah || 0;
    const priceB = b.price?.eur || b.price?.uah || 0;
    return priceB - priceA;
  });

  return (
    <>
      {/* Cinematic Hero (if config exists) */}
      {config && (
        <BrabusCollectionHero
          locale={resolvedLocale}
          config={config}
          productCount={sortedProducts.length}
        />
      )}

      {/* Product Grid with Full Kit first */}
      <BrabusCollectionProductGrid
        locale={resolvedLocale}
        handle={handle}
        title={config ? (resolvedLocale === 'ua' ? config.titleUk : config.title) : (card?.title ?? handle)}
        brand="Brabus Tuning"
        products={sortedProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
