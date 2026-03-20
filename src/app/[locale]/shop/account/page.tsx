import { redirect } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import { prisma } from '@/lib/prisma';
import ShopAccountClient from './components/ShopAccountClient';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import {
  getOrdersForCustomerDisplay,
  serializeShopCustomerProfile,
  shopCustomerProfileIncludeWithoutOrders,
} from '@/lib/shopCustomers';
import { normalizeShopStoreKey } from '@/lib/shopStores';

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
  searchParams: Promise<{ store?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account', {
    title: resolvedLocale === 'ua' ? 'Акаунт магазину | One Company' : 'Shop account | One Company',
    description: resolvedLocale === 'ua' ? 'Приватний кабінет клієнта магазину.' : 'Private customer account for One Company shop.',
  });
}

export default async function ShopAccountPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { store } = await searchParams;
  const storeKey = normalizeShopStoreKey(Array.isArray(store) ? store[0] : store);
  const session = await getCurrentShopCustomerSession();

  if (!session) {
    redirect(`/${locale}/shop/account/login?store=${encodeURIComponent(storeKey)}&next=${encodeURIComponent(`/${locale}/shop/account?store=${encodeURIComponent(storeKey)}`)}`);
  }

  const customer = await prisma.shopCustomer.findUnique({
    where: { id: session.customerId },
    include: shopCustomerProfileIncludeWithoutOrders,
  });

  if (!customer) {
    redirect(`/${locale}/shop/account/login?store=${encodeURIComponent(storeKey)}`);
  }

  const orders = await getOrdersForCustomerDisplay(prisma, customer.id, customer.email, storeKey);
  const profile = serializeShopCustomerProfile({ ...customer, orders });

  return <ShopAccountClient locale={locale} profile={profile} storeKey={storeKey} />;
}
