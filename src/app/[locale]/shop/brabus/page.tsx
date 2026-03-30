import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import BrabusHomeSignature from '../components/BrabusHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/brabus', {
    title: resolvedLocale === 'ua' ? 'Brabus | One Company' : 'Brabus | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальний тюнінг Brabus. Офіційний постачальник в Україні.'
        : 'Premium Brabus tuning. Official supplier in Ukraine.',
  });
}

export default async function ShopBrabusPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return (
    <>
      {/* 1. Cinematic Home: Hero + Showcases + Fleet + Rocket */}
      <BrabusHomeSignature locale={resolvedLocale} />
    </>
  );
}

