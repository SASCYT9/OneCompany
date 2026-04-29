import { resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { buildOhlinsHeroVehicleTree } from '@/lib/ohlinsCatalog';
import OhlinsHomeSignature from '../components/OhlinsHomeSignature';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = 'force-static';
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

function isOhlinsProduct(product: { brand?: string | null; vendor?: string | null; slug?: string }) {
  const brand = product.brand?.toLowerCase();
  const vendor = product.vendor?.toLowerCase();
  return brand === 'ohlins' || brand === 'öhlins' || vendor === 'ohlins' || product.slug?.startsWith('ohlins-');
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = resolveLocale(locale) === 'ua';

  return {
    title: isUa ? 'Öhlins Підвіски | Офіційний Дилер | OneCompany' : 'Öhlins Suspension | Official Dealer | OneCompany',
    description: isUa
      ? 'Ексклюзивні підвіски Öhlins: Road & Track, Advanced Track Day, та Dedicated Track серії. Замовляйте з доставкою. OneCompany - офіційний дилер.'
      : 'Exclusive Öhlins suspensions: Road & Track, Advanced Track Day, and Dedicated Track series. Buy with worldwide shipping. OneCompany - official dealer.',
  };
}

export default async function OhlinsSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const products = await getShopProductsServer();
  const ohlinsProducts = products.filter(isOhlinsProduct);
  const availableVehicles = buildOhlinsHeroVehicleTree(ohlinsProducts);

  return <OhlinsHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
