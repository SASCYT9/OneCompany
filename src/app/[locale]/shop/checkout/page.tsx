import { resolveLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShopCheckoutClient from './ShopCheckoutClient';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, 'shop/checkout', {
    title: l === 'ua' ? 'Оформлення замовлення | One Company' : 'Checkout | One Company',
    description: l === 'ua' ? 'Оформіть замовлення в One Company.' : 'Complete your order at One Company.',
  });
}

export default async function ShopCheckoutPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return <ShopCheckoutClient locale={resolvedLocale} />;
}
