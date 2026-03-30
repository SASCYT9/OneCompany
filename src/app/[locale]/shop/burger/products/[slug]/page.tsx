import ShopProductDetailPage, { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({ locale, slug, mode: 'burger' });
}

export default async function BurgerShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  return <ShopProductDetailPage locale={locale} slug={slug} mode="burger" />;
}
