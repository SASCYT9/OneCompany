import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { JsonLd, generateBrandSchema } from '@/lib/jsonLd';
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

  const description = resolvedLocale === 'ua'
    ? 'Преміальні обвіси Urban Automotive. Офіційний постачальник в Україні.'
    : 'Premium Urban Automotive body kits. Official supplier in Ukraine.';

  return (
    <>
      <JsonLd 
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: 'shop/urban',
          brandName: 'Urban Automotive',
          description,
        })} 
      />
      <UrbanHomeSignature locale={resolvedLocale} />
    </>
  );
}
