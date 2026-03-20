import { resolveLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShopCartClient from './ShopCartClient';
import { normalizeShopStoreKey } from '@/lib/shopStores';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ store?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, 'shop/cart', {
    title: l === 'ua' ? 'Кошик | One Company' : 'Cart | One Company',
    description: l === 'ua' ? 'Ваш кошик товарів One Company.' : 'Your One Company cart.',
  });
}

export default async function ShopCartPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { store } = await searchParams;
  const resolvedLocale = resolveLocale(locale);
  const storeKey = normalizeShopStoreKey(Array.isArray(store) ? store[0] : store);
  return <ShopCartClient locale={resolvedLocale} storeKey={storeKey} />;
}
