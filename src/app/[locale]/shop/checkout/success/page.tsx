import { resolveLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShopOrderSuccessClient from './ShopOrderSuccessClient';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string; token?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, 'shop/checkout/success', {
    title: l === 'ua' ? 'Замовлення прийнято | One Company' : 'Order confirmed | One Company',
    description: l === 'ua' ? 'Ваше замовлення прийнято.' : 'Your order has been placed.',
  });
}

export default async function ShopOrderSuccessPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { order, token } = await searchParams;
  const resolvedLocale = resolveLocale(locale);
  return <ShopOrderSuccessClient locale={resolvedLocale} orderNumber={order} token={token} />;
}
