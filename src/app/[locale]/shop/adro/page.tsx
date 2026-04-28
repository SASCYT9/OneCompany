import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { buildAdroHeroVehicleTree, isAdroProduct } from '@/lib/adroCatalog';
import AdroHomeSignature from '../components/AdroHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/adro', {
    title:
      resolvedLocale === 'ua'
        ? 'ADRO — Карбонові Аерокіти Преміум-Класу | One Company'
        : 'ADRO — Premium Carbon Fiber Aerokits | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні карбонові аерокіти ADRO з CFD-валідацією рівня F1. Препрег-карбон для BMW, Porsche, Toyota та Tesla.'
        : 'Premium ADRO carbon fiber aerokits with F1-level CFD validation. Prepreg carbon for BMW, Porsche, Toyota, and Tesla.',
  });
}

export default async function ShopAdroPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const products = await getShopProductsServer();
  const adroProducts = products.filter(isAdroProduct);
  const availableVehicles = buildAdroHeroVehicleTree(adroProducts);

  return <AdroHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
