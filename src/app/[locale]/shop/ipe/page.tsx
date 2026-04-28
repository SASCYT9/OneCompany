import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { isIpeProduct } from '@/lib/ipeBrand';
import { buildIpeHeroVehicleTree } from '@/lib/ipeHeroCatalog';
import IpeHomeSignature from '../components/IpeHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/ipe', {
    title:
      resolvedLocale === 'ua'
        ? 'iPE Exhaust — Титанові Вихлопні Системи | One Company'
        : 'iPE Exhaust — Titanium Exhaust Systems | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні титанові вихлопні системи Innotech Performance Exhaust (iPE) з фірмовим F1-звучанням і valvetronic-керуванням.'
        : 'Premium titanium Innotech Performance Exhaust (iPE) systems with signature F1-pitch sound and valvetronic control.',
  });
}

export default async function ShopIpePage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const products = await getShopProductsServer();
  const ipeProducts = products.filter(isIpeProduct);
  const availableVehicles = buildIpeHeroVehicleTree(ipeProducts);

  return <IpeHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
