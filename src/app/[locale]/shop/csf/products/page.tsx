import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/csf/products → redirect to /shop/csf/collections
 * CSF uses "collections" for its catalog listing.
 */
export default async function CsfProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/csf/collections`);
}
