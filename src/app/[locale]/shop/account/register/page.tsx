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
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/register', {
    title: resolvedLocale === 'ua' ? 'Реєстрація shop account | One Company' : 'Shop account registration | One Company',
    description: resolvedLocale === 'ua' ? 'Створення приватного shop account.' : 'Create a private customer account for One Company shop.',
  });
}

export default async function ShopAccountRegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { store } = await searchParams;
  const storeKey = normalizeShopStoreKey(Array.isArray(store) ? store[0] : store);
  return <ShopAccountAuthClient locale={locale} mode="register" storeKey={storeKey} />;
}
