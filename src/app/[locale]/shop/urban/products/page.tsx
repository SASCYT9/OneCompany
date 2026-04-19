import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import UrbanVehicleFilter from '../../components/UrbanVehicleFilter';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getUrbanCatalogProducts } from '@/lib/urbanCollectionMatcher';
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
  return buildPageMetadata(resolvedLocale, 'shop/urban/products', {
    title: resolvedLocale === 'ua' ? 'Глобальний Каталог Urban Automotive | One Company' : 'Urban Automotive Global Catalog | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Повний каталог преміальних компонентів для тюнінгу Urban Automotive. Аеродинаміка, диски, вихлопні системи.'
        : 'Full catalog of premium Urban Automotive tuning components. Aerodynamics, wheels, exhaust systems.',
  });
}

export default async function UrbanProductsCatalogPage({ params }: Props) {
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

  const urbanProducts = getUrbanCatalogProducts(products);

  return (
    <div className="relative min-h-screen bg-black">
      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
          <Link href={`/${locale}/shop/urban`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
            <span>←</span> {resolvedLocale === 'ua' ? 'Головна Urban Automotive' : 'Urban Automotive Home'}
          </Link>
        </div>
        <UrbanVehicleFilter 
          locale={resolvedLocale} 
          products={urbanProducts} 
          viewerContext={viewerContext} 
        />
      </div>
    </div>
  );
}
