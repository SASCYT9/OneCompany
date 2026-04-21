import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import RacechipHomeSignature from '../components/RacechipHomeSignature';

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
  return buildPageMetadata(resolvedLocale, 'shop/racechip', {
    title:
      resolvedLocale === 'ua'
        ? 'RaceChip Україна | GTS 5 + App Control | One Company'
        : 'RaceChip Catalog | GTS 5 + App Control | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Офіційний магазин RaceChip. Максимальна потужність з GTS 5 + управління зі смартфону (App Control). 50+ брендів авто.'
        : 'Official RaceChip storefront. Maximize performance with GTS 5 + Smartphone App Control. 50+ vehicle brands.',
  });
}

export default async function RaceChipHomePage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <RacechipHomeSignature locale={resolvedLocale} />;
}
