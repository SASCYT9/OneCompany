import ShopProductDetailPage, { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({ locale, slug, mode: 'do88' });
}

export default async function Do88ShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  return <ShopProductDetailPage locale={locale} slug={slug} mode="do88" />;
}
