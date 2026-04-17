import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/ipe/products → redirect to /shop/ipe/collections
 * IPE uses "collections" for its catalog listing.
 * This catch-all prevents 404 when users navigate to /products directly.
 */
export default async function IpeProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/ipe/collections`);
}
