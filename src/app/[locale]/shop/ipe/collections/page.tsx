import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import Link from 'next/link';
import Image from 'next/image';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { isIpeProduct } from '@/lib/ipeBrand';
import IpeVehicleFilter from '../../components/IpeVehicleFilter';

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = 'force-static';
export const revalidate = 3600;

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
  return buildPageMetadata(resolvedLocale, 'shop/ipe/collections', {
    title:
      resolvedLocale === 'ua'
        ? 'Каталог Продукції iPE | Innotech Performance Exhaust | One Company'
        : 'iPE Product Catalog | Innotech Performance Exhaust | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний каталог преміальних вихлопних систем iPE: Valvetronic, Downpipe, Headers та аксесуари.'
        : 'Full catalog of premium iPE exhaust systems: Valvetronic, Downpipe, Headers and accessories.',
  });
}

export default async function IpeCollectionsPage({ params }: Props) {
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

  const ipeProducts = products.filter(isIpeProduct);

  return (
    <div className="relative min-h-screen bg-black">
      {/* Premium Black & Bronze Backdrop */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/shop/ipe/ipe-factory.png"
          alt="iPE Workshop"
          fill
          priority
          className="object-cover opacity-20 sepia-[.4] hue-rotate-[-10deg]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0600]/80 via-black/90 to-[#050300] backdrop-blur-[10px]" />
        
        {/* Signature Bronze Accent Ambient Glow */}
        <div className="absolute top-1/4 right-1/4 w-[800px] h-[400px] bg-[#c29d59]/5 blur-[200px] rounded-full pointer-events-none mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6 pt-4">
          <Link href={`/${locale}/shop/ipe`} className="text-[10px] uppercase tracking-[0.2em] text-[#c29d59]/70 hover:text-[#c29d59] transition-colors font-semibold">
            ← {resolvedLocale === 'ua' ? 'Повернутися до iPE' : 'Return to iPE'}
          </Link>
        </div>
        
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c29d59]/30 border-t-[#c29d59]" />
            </div>
          }
        >
          <IpeVehicleFilter 
            locale={resolvedLocale} 
            products={ipeProducts} 
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/ipe/products`}
          />
        </Suspense>
      </div>
    </div>
  );
}
