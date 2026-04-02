import { resolveLocale } from '@/lib/seo';
import ShopProductDetailPage, { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({
    locale: resolveLocale(locale),
    slug,
    mode: 'ohlins',
  });
}

export default async function OhlinsProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  return (
    <ShopProductDetailPage
      locale={resolvedLocale}
      slug={slug}
      mode="ohlins"
    />
  );
}
