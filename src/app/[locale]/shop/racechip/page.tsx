import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
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

  return (
    <div className="bg-[#080808] min-h-screen font-sans">
      <RacechipHomeSignature locale={resolvedLocale} />
    </div>
  );
}
