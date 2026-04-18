import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getProductsForUrbanCollection } from '@/lib/urbanCollectionMatcher';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { URBAN_COLLECTION_CARDS } from '../../../data/urbanCollectionsList';
import { getUrbanCollectionPageConfig } from '../../../data/urbanCollectionPages.server';
import {
  UrbanCinematicHero,
  UrbanModelOverview,
  UrbanGalleryCarousel,
  UrbanVideoPointer,
  UrbanBannerStack,
  UrbanBlueprintKit,
} from '../../../components/UrbanCollectionSections';
import UrbanCollectionProductGrid from '../../../components/UrbanCollectionProductGrid';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

export async function generateStaticParams() {
  return URBAN_COLLECTION_CARDS.map((card) => ({ handle: card.collectionHandle }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const card = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
  const title = card ? `${card.title} | Urban | One Company` : 'Urban | One Company';
  return buildPageMetadata(resolvedLocale, `shop/urban/collections/${handle}`, {
    title: resolvedLocale === 'ua' ? `${card?.title ?? handle} | Urban | One Company` : title,
    description:
      resolvedLocale === 'ua'
        ? `Програма Urban для ${card?.title ?? handle}. Офіційний постачальник в Україні.`
        : `Urban programme for ${card?.title ?? handle}. Official supplier in Ukraine.`,
  });
}

export default async function UrbanCollectionHandlePage({ params }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';
  const config = getUrbanCollectionPageConfig(handle);
  const card = URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);
  const products = config ? await getShopProductsServer() : [];

  if (!config) {
    return (
      <>
        <div className="urban-back-to-stores">
          <Link href={`/${locale}/shop/urban/collections`} className="urban-back-to-stores__link">
            ← {isUa ? 'Усі колекції' : 'All collections'}
          </Link>
        </div>
        <section className="ucg" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <h1 className="ucg__card-title" style={{ position: 'static', marginBottom: 16 }}>
            {card?.title ?? handle}
          </h1>
          <p className="ucg__hero-sub" style={{ marginTop: 0 }}>
            {isUa ? 'Сторінка колекції готується.' : 'Collection page coming soon.'}
          </p>
          <Link href={`/${locale}/shop/urban/collections`} className="urban-bp__cta" style={{ marginTop: 24 }}>
            {isUa ? 'Усі колекції' : 'All collections'}
          </Link>
        </section>
      </>
    );
  }

  const [session, settingsRecord] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );

  const collectionProducts = getProductsForUrbanCollection(products, handle, card?.title, card?.brand).slice(
    0,
    config.productGrid.productsPerPage
  );
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: card?.title ?? config.overview.title,
    url: absoluteUrl(`/${resolvedLocale}/shop/urban/collections/${handle}`),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: collectionProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/urban/products/${product.slug}`),
        name: resolvedLocale === 'ua' ? product.title.ua : product.title.en,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="urban-back-to-stores">
        <Link href={`/${locale}/shop/urban/collections`} className="urban-back-to-stores__link">
          ← {isUa ? 'Усі колекції' : 'All collections'}
        </Link>
      </div>
      <UrbanCinematicHero locale={resolvedLocale} config={config.hero} />
      <UrbanModelOverview locale={resolvedLocale} config={config.overview} />
      <UrbanGalleryCarousel locale={resolvedLocale} config={config.gallery} />
      {config.videoPointer ? (
        <UrbanVideoPointer locale={resolvedLocale} config={config.videoPointer} />
      ) : null}
      <UrbanBannerStack locale={resolvedLocale} config={config.bannerStack} />
      <UrbanBlueprintKit locale={resolvedLocale} config={config.blueprint} />
      <UrbanCollectionProductGrid
        locale={resolvedLocale}
        title={card?.title ?? config.overview.title}
        brand={card?.brand ?? ''}
        products={collectionProducts}
        settings={config.productGrid}
        viewerContext={viewerContext}
      />
    </>
  );
}
