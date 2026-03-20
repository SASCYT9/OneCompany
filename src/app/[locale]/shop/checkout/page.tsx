import { resolveLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShopCheckoutClient from './ShopCheckoutClient';
import { normalizeShopStoreKey } from '@/lib/shopStores';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ store?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, 'shop/checkout', {
    title: l === 'ua' ? 'Оформлення замовлення | One Company' : 'Checkout | One Company',
    description: l === 'ua' ? 'Оформіть замовлення в One Company.' : 'Complete your order at One Company.',
  });
}

export default async function ShopCheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { store } = await searchParams;
  const resolvedLocale = resolveLocale(locale);
  const storeKey = normalizeShopStoreKey(Array.isArray(store) ? store[0] : store);
  return <ShopCheckoutClient locale={resolvedLocale} storeKey={storeKey} />;
}
