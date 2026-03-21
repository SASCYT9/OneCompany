import Link from 'next/link';
import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { buildShopListingResult, normalizeShopListingQuery } from '@/lib/shopListing';
import { getStorefrontPromotionHighlightsForItems } from '@/lib/shopPromotions';
import { getProductsForUrbanCollection } from '@/lib/urbanCollectionMatcher';
import { prisma } from '@/lib/prisma';
import { URBAN_COLLECTION_CARDS } from '../../../data/urbanCollectionsList';
import { getUrbanCollectionPageConfig, getUrbanCollectionTemplateHandles } from '../../../data/urbanCollectionPages.server';
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
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
    brand?: string | string[];
    category?: string | string[];
    priceMin?: string | string[];
    priceMax?: string | string[];
    availability?: string | string[];
    store?: string | string[];
    collection?: string | string[];
  }>;
};

export async function generateStaticParams() {
  return getUrbanCollectionTemplateHandles().map((handle) => ({ handle }));
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

export default async function UrbanCollectionHandlePage({ params, searchParams }: Props) {
  const { locale, handle } = await params;
  const rawSearchParams = await searchParams;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';
  const config = getUrbanCollectionPageConfig(handle);
  const card = URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);
  const [products, session] = config
    ? await Promise.all([getShopProductsServer(), getCurrentShopCustomerSession()])
    : [[], null];

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

  const collectionProducts = getProductsForUrbanCollection(products, handle, card?.title, card?.brand);
  const listingQuery = normalizeShopListingQuery(rawSearchParams, {
    store: 'urban',
    collection: handle,
  });
  const listing = buildShopListingResult(collectionProducts, {
    locale: resolvedLocale,
    currency: 'UAH',
    rates: null,
    query: listingQuery,
  });
  const collectionPromotions = await getStorefrontPromotionHighlightsForItems(prisma, {
    storeKey: 'urban',
    locale: resolvedLocale,
    customerGroup: session?.group ?? null,
    items: collectionProducts.map((product) => ({
      productSlug: product.slug,
      brand: product.brand ?? null,
      categorySlug: product.categoryNode?.slug ?? null,
    })),
  });
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: card?.title ?? config.overview.title,
    url: absoluteUrl(`/${resolvedLocale}/shop/urban/collections/${handle}`),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: listing.products.map((product, index) => ({
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
      {collectionPromotions.length ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-3">
            {collectionPromotions.slice(0, 2).map((promotion) => (
              <div
                key={promotion.id}
                className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-4 backdrop-blur"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/75">
                  {promotion.code ? `${promotion.code} · ` : ''}
                  {isUa ? 'Акція колекції' : 'Collection promotion'}
                </p>
                <p className="mt-1 text-lg font-medium text-emerald-50">{promotion.title}</p>
                {promotion.description ? (
                  <p className="mt-1 text-sm text-emerald-100/75">{promotion.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {config.videoPointer ? (
        <UrbanVideoPointer locale={resolvedLocale} config={config.videoPointer} />
      ) : null}
      <UrbanBannerStack locale={resolvedLocale} config={config.bannerStack} />
      <UrbanBlueprintKit locale={resolvedLocale} config={config.blueprint} />
      <UrbanCollectionProductGrid
        locale={resolvedLocale}
        handle={handle}
        title={card?.title ?? config.overview.title}
        brand={card?.brand ?? ''}
        products={collectionProducts}
        settings={config.productGrid}
      />
    </>
  );
}
