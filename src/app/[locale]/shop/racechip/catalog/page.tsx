import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import Link from 'next/link';
import RacechipVehicleFilter from '../../components/RacechipVehicleFilter';
import '../racechip-shop.css';

// racechip/catalog inlines the full Racechip product catalogue (~25 MB
// pre-rendered) which exceeds Vercel's ISR fallback limit (19.07 MB).
// Stay dynamic; future optimization: paginate or split the catalog.

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
  return buildPageMetadata(resolvedLocale, 'shop/racechip/catalog', {
    title:
      resolvedLocale === 'ua'
        ? 'RaceChip Каталог | Знайди свій тюнінг | One Company'
        : 'RaceChip Catalog | Find Your Tuning | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Офіційний каталог RaceChip. Максимальна потужність з GTS 5 + управління зі смартфону (App Control). 4900+ модифікацій.'
        : 'Official RaceChip catalog. Maximize performance with GTS 5 + Smartphone App Control. 4900+ modifications.',
  });
}

export default async function RaceChipProductsCatalogPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, products] = await Promise.all([    getOrCreateShopSettings(prisma),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const racechipProducts = products.filter(
    (p) => p.brand?.toLowerCase() === 'racechip' || p.vendor?.toLowerCase() === 'racechip'
  );

  const isUa = resolvedLocale === 'ua';

  return (
    <div className="relative min-h-screen bg-[#080808] text-white overflow-hidden selection:bg-[#ff4a00] selection:text-white font-sans">
      {/* Stealth Wealth Atmosphere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-[#ff4a00] opacity-[0.02] blur-[180px] pointer-events-none z-0 rounded-full"></div>
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none z-0"></div>

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        
        {/* Back Link */}
        <div className="mb-4 relative z-50">
          <Link href={`/${resolvedLocale}/shop/racechip`} className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-[#ff4a00] transition-colors font-light flex items-center gap-2">
            <span className="opacity-50">←</span> {isUa ? 'Повернутися до бренду' : 'Back to RaceChip Brand'}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense fallback={
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-[#ff4a00]/30 border-t-[#ff4a00] rounded-full animate-spin" />
            </div>
          }>
            <RacechipVehicleFilter
                locale={resolvedLocale}
                products={racechipProducts}
                viewerContext={viewerContext}
            />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
