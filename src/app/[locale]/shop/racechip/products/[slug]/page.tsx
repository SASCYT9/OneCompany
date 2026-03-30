import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import RacechipShopProductDetailLayout from '../../../components/RacechipShopProductDetailLayout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const p = await prisma.shopProduct.findUnique({ where: { slug } });
  if (!p) return {};
  
  const title = resolvedLocale === 'ua' && p.titleUa ? p.titleUa : p.titleEn;
  return buildPageMetadata(resolvedLocale, `shop/racechip/products/${slug}`, {
    title: `${title} | RaceChip Ukraine`,
    description: `Buy ${title} tuning module. Maximum performance and efficiency with RaceChip app control.`,
    image: p.image || undefined,
  });
}

export default async function RacechipProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  const product = await prisma.shopProduct.findUnique({
    where: { slug, status: 'ACTIVE' },
    include: { variants: true },
  });

  if (!product) {
    redirect(`/${resolvedLocale}/shop/racechip`);
  }

  const [session, settingsRecord] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );

  return (
    <RacechipShopProductDetailLayout
      locale={resolvedLocale}
      product={JSON.parse(JSON.stringify(product))}
      viewerContext={viewerContext}
    />
  );
}
