import { resolveLocale } from '@/lib/seo';
import ShopProductDetailPage, { getShopProductPageMetadata } from '../../../components/ShopProductDetailPage';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({
    locale: resolveLocale(locale),
    slug,
    mode: 'girodisc',
  });
}

export default async function GiroDiscProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  return (
    <ShopProductDetailPage
      locale={resolvedLocale}
      slug={slug}
      mode="girodisc"
    />
  );
}
