import { Suspense } from 'react';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { JsonLd, generateBrandSchema } from '@/lib/jsonLd';
import Do88HomeSignature from '../components/Do88HomeSignature';
import Do88CollectionsGrid from '../components/Do88CollectionsGrid';
import Do88FeaturedModels from '../components/Do88FeaturedModels';
import OurStoresPortal from '../components/OurStoresPortal';
import '@/styles/urban-collections.css';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const revalidate = 3600;

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
  return buildPageMetadata(resolvedLocale, 'shop/do88', {
    title: resolvedLocale === 'ua' ? 'DO88 Performance | One Company' : 'DO88 Performance | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні системи охолодження DO88 зі Швеції. Інтеркулери, радіатори та силіконові патрубки для максимальної ефективності.'
        : 'Premium DO88 performance cooling systems from Sweden. Intercoolers, radiators, and silicone hoses built for maximum efficiency.',
  });
}

export default async function ShopDo88Page({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const description = resolvedLocale === 'ua'
    ? 'Преміальні системи охолодження DO88 зі Швеції. Інтеркулери, радіатори та силіконові патрубки для максимальної ефективності.'
    : 'Premium DO88 performance cooling systems from Sweden. Intercoolers, radiators, and silicone hoses built for maximum efficiency.';

  return (
    <>
      <JsonLd 
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: 'shop/do88',
          brandName: 'DO88',
          description,
        })} 
      />
      <Do88HomeSignature locale={resolvedLocale} />
      
      <Suspense fallback={<div className="h-64 bg-black" />}>
        <Do88CollectionsGrid locale={resolvedLocale} />
      </Suspense>
      
      <Do88FeaturedModels locale={resolvedLocale} />
    </>
  );
}
