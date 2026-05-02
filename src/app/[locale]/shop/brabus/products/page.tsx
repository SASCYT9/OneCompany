import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import BrabusVehicleFilter from '../../components/BrabusVehicleFilter';
import BrabusVideoBackground from '../../components/BrabusVideoBackground';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { isFactoryOnlyProduct } from '@/lib/brabusFactoryOnly';
import { isBrabusExhaustProduct } from '@/lib/brabusCatalogExclusions';
import Link from 'next/link';

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
  return buildPageMetadata(resolvedLocale, 'shop/brabus/products', {
    title: resolvedLocale === 'ua' ? 'Каталог компонентів Brabus | One Company' : 'Brabus Component Catalog | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний каталог преміальних компонентів для тюнінгу Brabus. Аеродинаміка, диски, вихлопні системи.'
        : 'Full catalog of premium Brabus tuning components. Aerodynamics, wheels, exhaust systems.',
  });
}

export default async function BrabusProductsCatalogPage({ params }: Props) {
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

  const brabusProducts = products
    .filter(p => p.brand?.toLowerCase() === 'brabus')
    .filter(p => !isFactoryOnlyProduct(p.sku))
    .filter(p => !isBrabusExhaustProduct(p));

  return (
    <div className="relative min-h-screen bg-black">
      {/* Premium Blurred Video Backdrop */}
      <div className="fixed inset-0 z-0">
        <BrabusVideoBackground 
          videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
          fallbackImage="/images/shop/brabus/hq/brabus-supercars-26.jpg" 
        />
        <div className="absolute inset-0 bg-black/65 backdrop-blur-xl" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
          <Link href={`/${locale}/shop/brabus`} className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">
            ← {resolvedLocale === 'ua' ? 'Головна Brabus' : 'Brabus home'}
          </Link>
        </div>
        <BrabusVehicleFilter 
          locale={resolvedLocale} 
          products={brabusProducts} 
          viewerContext={viewerContext} 
        />
      </div>
    </div>
  );
}
