import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import BurgerVehicleFilter from '../../components/BurgerVehicleFilter';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import Link from 'next/link';

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

  const burgerProducts = products.filter(
    (p) => p.brand?.toLowerCase() === 'burger motorsports'
  );

  return (
    <div className="relative min-h-screen" style={{ background: '#0a0a0a' }}>
      <div style={{ paddingTop: '100px' }}>
        <div className="burger-back">
          <Link href={`/${locale}/shop/burger`} className="burger-back__link">
            ← {resolvedLocale === 'ua' ? 'Головна Burger' : 'Burger home'}
          </Link>
        </div>
        <BurgerVehicleFilter
          locale={resolvedLocale}
          products={burgerProducts}
          viewerContext={viewerContext}
        />
      </div>
    </div>
  );
}
