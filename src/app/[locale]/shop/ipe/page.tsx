import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import IpeHomeSignature from '../components/IpeHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/ipe', {
    title:
      resolvedLocale === 'ua'
        ? 'iPE Exhaust — Титанові Вихлопні Системи | One Company'
        : 'iPE Exhaust — Titanium Exhaust Systems | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Преміальні титанові вихлопні системи Innotech Performance Exhaust (iPE) з фірмовим F1-звучанням. Офіційний дистриб\'ютор в Україні.'
        : 'Premium titanium Innotech Performance Exhaust (iPE) systems with signature F1-pitch sound. Official distributor in Ukraine.',
  });
}

export default async function ShopIpePage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <IpeHomeSignature locale={resolvedLocale} />;
}
