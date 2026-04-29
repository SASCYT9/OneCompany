import { resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { buildGirodiscHeroVehicleTree, isGirodiscProduct } from '@/lib/girodiscHeroCatalog';
import GiroDiscHomeSignature from '../components/GiroDiscHomeSignature';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = 'force-static';
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = resolveLocale(locale) === 'ua';

  return {
    title: isUa ? 'GiroDisc Гальмівні Диски | Офіційний Дилер | OneCompany' : 'GiroDisc Rotors | Official Dealer | OneCompany',
    description: isUa
      ? 'Ексклюзивні 2-складові гальмівні диски GiroDisc, гоночні колодки та титанові щитки. Замовляйте з доставкою. OneCompany - офіційний дилер.'
      : 'Exclusive 2-piece high-performance brake rotors by GiroDisc, racing pads, and titanium heat shields. Buy with worldwide shipping. OneCompany - official dealer.',
  };
}

export default async function GiroDiscSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const products = await getShopProductsServer();
  const girodiscProducts = products.filter(isGirodiscProduct);
  const availableVehicles = buildGirodiscHeroVehicleTree(girodiscProducts);

  return <GiroDiscHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
