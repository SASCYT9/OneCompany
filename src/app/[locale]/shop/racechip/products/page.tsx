import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/racechip/products → redirect to /shop/racechip/catalog
 * RaceChip uses "catalog" for its catalog listing.
 */
export default async function RacechipProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/racechip/catalog`);
}
