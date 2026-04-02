import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import CSFHomeSignature from '../components/CSFHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/csf', {
    title:
      resolvedLocale === 'ua'
        ? 'CSF Racing | Офіційний дилер в Україні | One Company'
        : 'CSF Racing | Official Dealer in Ukraine | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Високопродуктивні радіатори, інтеркулери та системи охолодження CSF Racing. Офіційна продукція.'
        : 'High-performance radiators, intercoolers, and cooling systems by CSF Racing. Official products.',
  });
}

export default async function CSFRacingPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <CSFHomeSignature locale={resolvedLocale} />;
}
