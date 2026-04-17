import { redirect } from 'next/navigation';
import { resolveLocale } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * /shop/adro/products → redirect to /shop/adro/collections
 * ADRO uses "collections" for its catalog listing.
 */
export default async function AdroProductsRedirect({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  redirect(`/${resolvedLocale}/shop/adro/collections`);
}
