import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { JsonLd, generateBrandSchema } from '@/lib/jsonLd';
import AkrapovicHomeSignature from '../components/AkrapovicHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/akrapovic', {
    title:
      resolvedLocale === 'ua'
        ? 'Akrapovič — Титанові Вихлопні Системи | One Company'
        : 'Akrapovič — Titanium Exhaust Systems | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні титанові та карбонові вихлопні системи Akrapovič для BMW, Porsche, Mercedes, Audi, Lamborghini та Ferrari.'
        : 'Premium titanium & carbon fibre Akrapovič exhaust systems for BMW, Porsche, Mercedes, Audi, Lamborghini, and Ferrari.',
  });
}

export default async function ShopAkrapovicPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const description = resolvedLocale === 'ua'
    ? 'Преміальні титанові та карбонові вихлопні системи Akrapovič для BMW, Porsche, Mercedes, Audi, Lamborghini та Ferrari.'
    : 'Premium titanium & carbon fibre Akrapovič exhaust systems for BMW, Porsche, Mercedes, Audi, Lamborghini, and Ferrari.';

  return (
    <>
      <JsonLd 
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: 'shop/akrapovic',
          brandName: 'Akrapovič',
          description,
        })} 
      />
      <AkrapovicHomeSignature locale={resolvedLocale} />
    </>
  );
}
