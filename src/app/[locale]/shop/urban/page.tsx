import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import UrbanHomeSignature from '../components/UrbanHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/urban', {
    title: resolvedLocale === 'ua' ? 'Urban Automotive | One Company' : 'Urban Automotive | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні обвіси Urban Automotive. Офіційний постачальник в Україні.'
        : 'Premium Urban Automotive body kits. Official supplier in Ukraine.',
  });
}

export default async function ShopUrbanPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <UrbanHomeSignature locale={resolvedLocale} />;
}
