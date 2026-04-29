import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getProductsForUrbanCollection, sortUrbanCollectionProducts } from '@/lib/urbanCollectionMatcher';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { buildUrbanCollectionImagePool } from '@/lib/urbanImageUtils';
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

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = 'force-static';
export const revalidate = 3600;

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
        ? `Програма Urban для ${card?.title ?? handle}. Фірмові обвіси, карбон і виразні деталі екстерʼєру.`
        : `Urban programme for ${card?.title ?? handle}. Signature body kits, carbon details, and bold exterior styling.`,
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
      <div className="relative min-h-screen bg-black overflow-hidden flex flex-col pt-[100px]">
        <div className="w-full max-w-[1720px] mx-auto px-6 md:px-12 lg:px-16 pb-4">
          <Link href={`/${locale}/shop/urban/collections`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.3)] relative z-50">
            <span>←</span> {isUa ? 'Усі колекції' : 'All collections'}
          </Link>
        </div>
        <section className="relative flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="relative z-10 flex flex-col items-center -mt-20">
            {card?.brand && (
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c29d59] drop-shadow-md">
                {card.brand}
              </p>
            )}
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-6xl md:text-7xl uppercase">
              {card?.title ?? handle}
            </h1>
            <p className="max-w-2xl text-balance text-lg font-light text-white/50">
              {isUa 
                ? 'Детальна сторінка цієї колекції наразі розробляється. Ви можете скористатися загальним каталогом бази Urban для перегляду усіх товарів.' 
                : 'The detailed showcase for this collection is currently under development. You can browse the general Urban catalog database for products.'}
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href={`/${locale}/shop/urban/collections`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-8 text-xs font-semibold uppercase tracking-[0.15em] text-white transition duration-300 hover:border-white/25 hover:bg-white/10 backdrop-blur-md"
              >
                {isUa ? 'Усі колекції' : 'All collections'}
              </Link>
              <Link
                href={`/${locale}/shop/urban/products`}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-br from-[#c29d59] to-[#a48245] px-8 text-xs font-semibold uppercase tracking-[0.15em] text-black transition duration-300 hover:from-[#ead29d] hover:to-[#c29d59]"
              >
                {isUa ? 'В магазин' : 'To catalog'}
              </Link>
            </div>
          </div>
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          {card?.externalImageUrl && (
            <div className="absolute inset-0 z-0 opacity-[0.2] blur-xl">
              <img src={card.externalImageUrl} className="h-full w-full object-cover grayscale" alt="" />
            </div>
          )}
        </section>
      </div>
    );
  }

  const [settingsRecord] = await Promise.all([    getOrCreateShopSettings(prisma),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const matchedProducts = getProductsForUrbanCollection(products, handle, card?.title, card?.brand);
  const collectionProducts = sortUrbanCollectionProducts(matchedProducts, viewerContext).slice(
    0,
    config.productGrid.productsPerPage
  );
  const collectionImages = buildUrbanCollectionImagePool(config, [handle]);
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
      <div className="absolute left-6 top-6 z-[100] md:left-12 lg:left-16 pt-[80px]">
        <Link href={`/${locale}/shop/urban/collections`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 transition-all hover:border-white/25 hover:bg-black/60 hover:text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <span>←</span> {isUa ? 'Усі колекції' : 'All collections'}
        </Link>
      </div>
      <UrbanCinematicHero locale={resolvedLocale} config={config.hero} />
      <UrbanModelOverview locale={resolvedLocale} config={config.overview} />
      <UrbanCollectionProductGrid
        locale={resolvedLocale}
        title={card?.title ?? config.overview.title}
        brand={card?.brand ?? ''}
        collectionHandle={handle}
        collectionImages={collectionImages}
        products={collectionProducts}
        settings={config.productGrid}
        viewerContext={viewerContext}
      />
      <UrbanGalleryCarousel locale={resolvedLocale} config={config.gallery} />
      {config.videoPointer ? (
        <UrbanVideoPointer locale={resolvedLocale} config={config.videoPointer} />
      ) : null}
      <UrbanBannerStack locale={resolvedLocale} config={config.bannerStack} />
      <UrbanBlueprintKit locale={resolvedLocale} config={config.blueprint} />
    </>
  );
}
