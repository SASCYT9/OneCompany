import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import BrabusHomeSignature from '../components/BrabusHomeSignature';
import BrabusVehicleFilter from '../components/BrabusVehicleFilter';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';

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
  return buildPageMetadata(resolvedLocale, 'shop/brabus', {
    title: resolvedLocale === 'ua' ? 'Brabus | One Company' : 'Brabus | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальний тюнінг Brabus. Офіційний постачальник в Україні.'
        : 'Premium Brabus tuning. Official supplier in Ukraine.',
  });
}

export default async function ShopBrabusPage({ params }: Props) {
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

  const brabusProducts = products.filter(p => p.brand?.toLowerCase() === 'brabus');

  return (
    <>
      {/* 1. Cinematic Home: Hero + Showcases + Fleet + Rocket */}
      <BrabusHomeSignature locale={resolvedLocale} />
      
      {/* 2. Filterable Catalog */}
      <BrabusVehicleFilter 
        locale={resolvedLocale} 
        products={brabusProducts} 
        viewerContext={viewerContext} 
      />
    </>
  );
}

