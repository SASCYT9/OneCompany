import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { buildCsfHeroSummary, isCsfProduct } from '@/lib/csfHeroCatalog';
import CSFHomeSignature from '../components/CSFHomeSignature';

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
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
        ? 'CSF Racing | Системи Охолодження | One Company'
        : 'CSF Racing | Performance Cooling | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Високопродуктивні радіатори, інтеркулери та системи охолодження CSF Racing для дороги й треку.'
        : 'High-performance radiators, intercoolers, and cooling systems by CSF Racing for road and track.',
  });
}

export default async function CSFRacingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  // Await searchParams in Next.js 15+
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const src = typeof resolvedSearchParams.src === 'string' ? resolvedSearchParams.src : undefined;

  const products = await getShopProductsServer();
  const csfProducts = products.filter(isCsfProduct);
  const heroSummary = buildCsfHeroSummary(csfProducts);

  return (
    <CSFHomeSignature
      locale={resolvedLocale}
      smmSource={src}
      heroSummary={heroSummary}
    />
  );
}
