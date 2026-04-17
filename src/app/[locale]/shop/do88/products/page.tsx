import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/do88/products → redirect to /shop/do88/collections
 * DO88 uses "collections" for its catalog listing.
 * This catch-all prevents 404 when users navigate to /products directly.
 */
export default async function Do88ProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/do88/collections`);
}
