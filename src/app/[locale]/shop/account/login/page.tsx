import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import ShopAccountAuthClient from '../components/ShopAccountAuthClient';
import { normalizeShopStoreKey } from '@/lib/shopStores';

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
  searchParams: Promise<{ store?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/login', {
    title: resolvedLocale === 'ua' ? 'Вхід в shop account | One Company' : 'Shop account login | One Company',
    description: resolvedLocale === 'ua' ? 'Вхід до приватного shop account.' : 'Sign in to the private shop account.',
  });
}

export default async function ShopAccountLoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { store } = await searchParams;
  const storeKey = normalizeShopStoreKey(Array.isArray(store) ? store[0] : store);
  return <ShopAccountAuthClient locale={locale} mode="login" storeKey={storeKey} />;
}
