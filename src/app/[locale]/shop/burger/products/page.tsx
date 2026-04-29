import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import BurgerVehicleFilter from '../../components/BurgerVehicleFilter';
import BurgerHeroPicker from '../../components/BurgerHeroPicker';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
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
  return buildPageMetadata(resolvedLocale, 'shop/burger/products', {
    title:
      resolvedLocale === 'ua'
        ? 'Каталог Burger Motorsports | JB4 Tuners & Parts | One Company'
        : 'Burger Motorsports Catalog | JB4 Tuners & Parts | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний каталог JB4 тюнерів, flex fuel кітів, інтейків та performance деталей для BMW та 30+ марок.'
        : 'Full catalog of JB4 tuners, flex fuel kits, intakes and performance parts for BMW and 30+ brands.',
  });
}

export default async function BurgerProductsCatalogPage({ params }: Props) {
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

  const burgerProducts = products.filter(
    (p) => p.brand?.toLowerCase() === 'burger motorsports'
  );

  return (
    <div className="relative min-h-screen" style={{ background: '#050505' }}>
      <div style={{ paddingTop: '100px' }}>
        <div className="burger-back">
          <Link href={`/${locale}/shop/burger`} className="burger-back__link">
            ← {resolvedLocale === 'ua' ? 'Головна Burger' : 'Burger home'}
          </Link>
        </div>

        {/* Top picker — same UX as home hero */}
        <div className="burger-catalog-picker">
          <Suspense fallback={null}>
            <BurgerHeroPicker locale={resolvedLocale} />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <BurgerVehicleFilter
            locale={resolvedLocale}
            products={burgerProducts}
            viewerContext={viewerContext}
          />
        </Suspense>
      </div>
    </div>
  );
}
