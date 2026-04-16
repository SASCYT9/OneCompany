import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import Link from 'next/link';
import OhlinsVehicleFilter from '../../components/OhlinsVehicleFilter';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, 'shop/ohlins/catalog', {
    title:
      resolvedLocale === 'ua'
        ? 'Öhlins Каталог Підвісок | Знайди свою модифікацію | One Company'
        : 'Öhlins Suspension Catalog | Find Your Setup | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Офіційний каталог Öhlins. DFV, TTX, Road & Track, Advanced Trackday та Motorsport підвіски для BMW, Porsche, Audi, Mercedes та інших.'
        : 'Official Öhlins catalog. DFV, TTX, Road & Track, Advanced Trackday and Motorsport suspension for BMW, Porsche, Audi, Mercedes and more.',
  });
}

export default async function OhlinsCatalogPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

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

  const ohlinsProducts = products.filter(
    (p) => p.brand?.toLowerCase() === 'ohlins' || p.brand?.toLowerCase() === 'öhlins' || p.vendor?.toLowerCase() === 'ohlins'
  );

  const isUa = resolvedLocale === 'ua';

  return (
    <div className="relative min-h-screen text-white overflow-hidden font-sans" style={{ background: '#0a0a0c', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Stealth Wealth Atmosphere — Öhlins Gold */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] opacity-[0.03] blur-[180px] pointer-events-none z-0 rounded-full"
        style={{ background: '#c29d59' }}
      />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none z-0" />

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">

        {/* Back Link */}
        <div className="mb-4 relative z-50">
          <Link
            href={`/${resolvedLocale}/shop/ohlins`}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-[#c29d59] transition-colors font-light flex items-center gap-2"
          >
            <span className="opacity-50">←</span> {isUa ? 'Повернутися до бренду' : 'Back to Öhlins'}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-[#c29d59]/30 border-t-[#c29d59] rounded-full animate-spin" />
              </div>
            }
          >
            <OhlinsVehicleFilter
              locale={resolvedLocale}
              products={ohlinsProducts}
              viewerContext={viewerContext}
            />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
