import { redirect } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import ShopAccountOrderDetailClient from './ShopAccountOrderDetailClient';

type Props = {
  params: Promise<{ locale: string; orderNumber: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, orderNumber } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/orders', {
    title: resolvedLocale === 'ua' ? `Замовлення ${orderNumber} | Кабінет` : `Order ${orderNumber} | Account`,
    description: resolvedLocale === 'ua' ? 'Деталі замовлення в кабінеті клієнта.' : 'Order details in customer account.',
  });
}

export default async function ShopAccountOrderDetailPage({ params }: Props) {
  const { locale, orderNumber } = await params;
  const session = await getCurrentShopCustomerSession();

  if (!session) {
    redirect(`/${locale}/shop/account/login?next=${encodeURIComponent(`/${locale}/shop/account/orders/${orderNumber}`)}`);
  }

  const resolvedLocale = resolveLocale(locale) as SupportedLocale;
  return <ShopAccountOrderDetailClient locale={resolvedLocale} orderNumber={orderNumber} />;
}
