import { buildPageMetadata, resolveLocale } from '@/lib/seo';
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
        ? 'Преміальні титанові та карбонові вихлопні системи Akrapovič. Офіційний постачальник в Україні. BMW, Porsche, Mercedes, Audi, Lamborghini, Ferrari.'
        : 'Premium titanium & carbon fibre Akrapovič exhaust systems. Official supplier in Ukraine. BMW, Porsche, Mercedes, Audi, Lamborghini, Ferrari.',
  });
}

export default async function ShopAkrapovicPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <AkrapovicHomeSignature locale={resolvedLocale} />;
}
