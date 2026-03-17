import { PrismaClient } from '@prisma/client';
import { redirect } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import ShopAccountClient from './components/ShopAccountClient';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import {
  getOrdersForCustomerDisplay,
  serializeShopCustomerProfile,
  shopCustomerProfileIncludeWithoutOrders,
} from '@/lib/shopCustomers';

const prisma = new PrismaClient();

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account', {
    title: resolvedLocale === 'ua' ? 'Акаунт магазину | One Company' : 'Shop account | One Company',
    description: resolvedLocale === 'ua' ? 'Приватний кабінет клієнта магазину.' : 'Private customer account for One Company shop.',
  });
}

export default async function ShopAccountPage({ params }: Props) {
  const { locale } = await params;
  const session = await getCurrentShopCustomerSession();

  if (!session) {
    redirect(`/${locale}/shop/account/login?next=${encodeURIComponent(`/${locale}/shop/account`)}`);
  }

  const customer = await prisma.shopCustomer.findUnique({
    where: { id: session.customerId },
    include: shopCustomerProfileIncludeWithoutOrders,
  });

  if (!customer) {
    redirect(`/${locale}/shop/account/login`);
  }

  const orders = await getOrdersForCustomerDisplay(prisma, customer.id, customer.email);
  const profile = serializeShopCustomerProfile({ ...customer, orders });

  return <ShopAccountClient locale={locale} profile={profile} />;
}
