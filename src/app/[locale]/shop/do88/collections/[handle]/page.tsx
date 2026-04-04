import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getProductsForDo88Collection } from '@/lib/do88CollectionMatcher';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { DO88_COLLECTION_CARDS } from '../../../data/do88CollectionsList';
import Do88CollectionProductGrid from '../../../components/Do88CollectionProductGrid';
import Do88VehicleFilter from '../../Do88VehicleFilter';
import Do88CategoryFilter from '../../Do88CategoryFilter';
import { Suspense } from 'react';

type Props = {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ brand?: string; keyword?: string }>;
};

export async function generateStaticParams() {
  return [
    { handle: 'all' },
    ...DO88_COLLECTION_CARDS.map((card) => ({ handle: card.categoryHandle }))
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  let card = DO88_COLLECTION_CARDS.find((c) => c.categoryHandle === handle);
  if (handle === 'all') {
    card = { categoryHandle: 'all', title: 'All Parts', titleUk: 'Всі деталі', externalImageUrl: '' };
  }
  const title = card ? `${card.title} | DO88 | One Company` : 'DO88 | One Company';
  return buildPageMetadata(resolvedLocale, `shop/do88/collections/${handle}`, {
    title: resolvedLocale === 'ua' ? `${card?.titleUk ?? card?.title ?? handle} | DO88 | One Company` : title,
    description:
      resolvedLocale === 'ua'
        ? `Високопродуктивні ${card?.title ?? handle} DO88 зі Швеції. Офіційний постачальник в Україні.`
        : `High-performance DO88 ${card?.title ?? handle}. Official supplier in Ukraine.`,
  });
}

export default async function Do88CollectionHandlePage({ params, searchParams }: Props) {
  const { locale, handle } = await params;
  const paramsResolved = await searchParams;
  const brand = paramsResolved.brand;
  const keyword = paramsResolved.keyword;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';
  
  let card = DO88_COLLECTION_CARDS.find((item) => item.categoryHandle === handle);
  if (handle === 'all') {
    card = { categoryHandle: 'all', title: 'All Parts', titleUk: 'Всі деталі', externalImageUrl: '' };
  }

  if (!card) {
    return (
      <>
        <div className="urban-back-to-stores">
          <Link href={`/${locale}/shop/do88/collections`} className="urban-back-to-stores__link">
            ← {isUa ? 'Всі категорії' : 'All categories'}
          </Link>
        </div>
        <section className="ucg" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <h1 className="ucg__card-title" style={{ position: 'static', marginBottom: 16 }}>
            {handle}
          </h1>
          <p className="ucg__hero-sub" style={{ marginTop: 0 }}>
            {isUa ? 'Категорію не знайдено.' : 'Category not found.'}
          </p>
          <Link href={`/${locale}/shop/do88/collections`} className="urban-bp__cta" style={{ marginTop: 24, padding: '12px 24px', backgroundColor: '#0ea5e9', color: '#000', borderRadius: '4px', fontWeight: 'bold' }}>
            {isUa ? 'До всіх категорій' : 'Go to all categories'}
          </Link>
        </section>
      </>
    );
  }

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

  let collectionProducts = getProductsForDo88Collection(products, handle, card.title);

  if (brand || keyword) {
    collectionProducts = collectionProducts.filter((product) => {
      const searchableText = [
        product.title.en,
        product.title.ua,
        product.shortDescription?.en,
        product.shortDescription?.ua,
        product.longDescription?.en,
        product.longDescription?.ua,
        ...(product.tags ?? []),
        product.slug,
        product.sku
      ].filter(Boolean).join(' ').toLowerCase();
      
      const matchesBrand = !brand || searchableText.includes(brand.toLowerCase());
      
      let matchesKeyword = true;
      if (keyword) {
        const groups = keyword.toLowerCase().split(/\s+/).filter(Boolean);
        matchesKeyword = groups.every(group => {
          let options = group.split('/');
          
          // Expand shorthand nomenclature (e.g. "mk5/6" -> ["mk5", "mk6"], "997.1/2" -> ["997.1", "997.2"])
          if (group.startsWith('mk') && options.length === 2 && /^\d+$/.test(options[1])) {
            options = [options[0], `mk${options[1]}`];
          } else if (group.startsWith('997.') && options.length === 2 && /^\d+$/.test(options[1])) {
            options = [options[0], `997.${options[1]}`];
          }
          
          // Match if AT LEAST ONE option inside the slash-group exists in the text
          return options.some(opt => searchableText.includes(opt.replace(/[()]/g, '')));
        });
      }
      
      return matchesBrand && matchesKeyword;
    });
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: card.title,
    url: absoluteUrl(`/${resolvedLocale}/shop/do88/collections/${handle}`),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: collectionProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/do88/products/${product.slug}`),
        name: product.title.en,
      })),
    },
  };

  const fallbackBanner = "/branding/do88/do88_car_hero_porsche_front_1774441447168.png";
  const bannerImage = card.externalImageUrl || fallbackBanner;

  return (
    <div className="relative min-h-screen bg-[#050505] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Background Banner */}
      <div 
        className="absolute top-0 left-0 w-full h-[350px] md:h-[450px] z-0 pointer-events-none"
        style={{
          backgroundImage: `url('${bannerImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.35,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505]" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-32 lg:pt-40 pb-20">
        <div className="mb-6">
          <Link href={`/${locale}/shop/do88/collections`} className="text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white transition inline-flex items-center gap-2">
            ← {isUa ? 'Всі категорії DO88' : 'All DO88 categories'}
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Left Sidebar */}
          <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6">
            <div className="sticky top-20 lg:top-40 z-20">
              <Suspense fallback={<div className="h-32 bg-white/5 rounded-2xl animate-pulse" />}>
                <Do88VehicleFilter locale={resolvedLocale} isSidebar={true} currentCategory={handle} />
              </Suspense>
              
              <div className="mt-8 hidden lg:block">
                <Suspense fallback={<div className="h-32 bg-white/5 rounded-xl animate-pulse" />}>
                  <Do88CategoryFilter locale={resolvedLocale} currentHandle={handle} variant="sidebar" />
                </Suspense>
              </div>
            </div>
          </aside>

          {/* Right Product Grid */}
          <main className="flex-1 min-w-0">
            <Do88CollectionProductGrid
              locale={resolvedLocale}
              handle={handle}
              title={card.title}
              titleUk={card.titleUk}
              products={collectionProducts}
              viewerContext={viewerContext}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
