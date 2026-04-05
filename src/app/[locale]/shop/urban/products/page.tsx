import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import UrbanVehicleFilter from '../../components/UrbanVehicleFilter';
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

  const urbanProducts = products.filter(p => p.brand?.toLowerCase() === 'urban automotive');

  return (
    <div className="relative min-h-screen bg-black">
      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
          <Link href={`/${locale}/shop/urban`} className="text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors">
            ← {resolvedLocale === 'ua' ? 'Головна Urban Automotive' : 'Urban Automotive Home'}
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
