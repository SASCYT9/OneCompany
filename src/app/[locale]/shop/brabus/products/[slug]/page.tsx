import ShopProductDetailPage, { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = 'force-static';
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({ locale, slug, mode: 'brabus' });
}

export default async function BrabusShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  return <ShopProductDetailPage locale={locale} slug={slug} mode="brabus" />;
}
