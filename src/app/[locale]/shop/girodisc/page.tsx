import { resolveLocale } from '@/lib/seo';
import GiroDiscHomeSignature from '../components/GiroDiscHomeSignature';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = resolveLocale(locale) === 'ua';

  return {
    title: isUa ? 'GiroDisc Гальмівні Диски | Офіційний Дилер | OneCompany' : 'GiroDisc Rotors | Official Dealer | OneCompany',
    description: isUa
      ? 'Ексклюзивні 2-складові гальмівні диски GiroDisc, гоночні колодки та титанові щитки. Замовляйте з доставкою. OneCompany - офіційний дилер.'
      : 'Exclusive 2-piece high-performance brake rotors by GiroDisc, racing pads, and titanium heat shields. Buy with worldwide shipping. OneCompany - official dealer.',
  };
}

export default async function GiroDiscSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <GiroDiscHomeSignature locale={resolvedLocale} />;
}
