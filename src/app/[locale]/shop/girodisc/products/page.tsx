import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/girodisc/products → redirect to /shop/girodisc/collections
 * GiroDisc uses "collections" for its catalog listing.
 */
export default async function GirodiscProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/girodisc/collections`);
}
