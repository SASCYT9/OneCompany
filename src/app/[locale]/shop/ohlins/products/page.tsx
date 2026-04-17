import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/ohlins/products → redirect to /shop/ohlins/collections
 * Öhlins uses "collections" for its catalog listing.
 */
export default async function OhlinsProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/ohlins/collections`);
}
