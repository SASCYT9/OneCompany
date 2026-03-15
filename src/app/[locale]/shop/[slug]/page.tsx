import { redirect } from 'next/navigation';
import ShopProductDetailPage, { getShopProductPageMetadata } from '../components/ShopProductDetailPage';
import { getShopProductBySlugServer } from '@/lib/shopCatalogServer';
import { getUrbanCollectionHandleForProduct } from '@/lib/urbanCollectionMatcher';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({ locale, slug, mode: 'default' });
}

export default async function ShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const product = await getShopProductBySlugServer(slug);
  const urbanHandle = product ? getUrbanCollectionHandleForProduct(product) : null;

  if (urbanHandle) {
    redirect(`/${locale}/shop/urban/products/${slug}`);
  }

  return <ShopProductDetailPage locale={locale} slug={slug} mode="default" />;
}
