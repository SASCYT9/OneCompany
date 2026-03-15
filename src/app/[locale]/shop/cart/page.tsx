import { resolveLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import ShopCartClient from './ShopCartClient';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = resolveLocale(locale);
  return buildNoIndexPageMetadata(l, 'shop/cart', {
    title: l === 'ua' ? 'Кошик | One Company' : 'Cart | One Company',
    description: l === 'ua' ? 'Ваш кошик товарів One Company.' : 'Your One Company cart.',
  });
}

export default async function ShopCartPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return <ShopCartClient locale={resolvedLocale} />;
}
