import { resolveLocale } from '@/lib/seo';
import OhlinsHomeSignature from '../components/OhlinsHomeSignature';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = resolveLocale(locale) === 'ua';

  return {
    title: isUa ? 'Öhlins Підвіски | Офіційний Дилер | OneCompany' : 'Öhlins Suspension | Official Dealer | OneCompany',
    description: isUa
      ? 'Ексклюзивні підвіски Öhlins: Road & Track, Advanced Track Day, та Dedicated Track серії. Замовляйте з доставкою. OneCompany - офіційний дилер.'
      : 'Exclusive Öhlins suspensions: Road & Track, Advanced Track Day, and Dedicated Track series. Buy with worldwide shipping. OneCompany - official dealer.',
  };
}

export default async function OhlinsSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <OhlinsHomeSignature locale={resolvedLocale} />;
}
