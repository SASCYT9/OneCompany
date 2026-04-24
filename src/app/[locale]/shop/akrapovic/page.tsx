import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { JsonLd, generateBrandSchema } from '@/lib/jsonLd';
import { prisma } from '@/lib/prisma';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
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

  const [session, settingsRecord, products] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );

  const akrapovicProducts = products.filter(
    (product) =>
      product.brand?.toLowerCase() === 'akrapovič' ||
      product.brand?.toLowerCase() === 'akrapovic' ||
      product.tags?.includes('Akrapovic')
  );

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
      <AkrapovicHomeSignature
        locale={resolvedLocale}
        products={akrapovicProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
