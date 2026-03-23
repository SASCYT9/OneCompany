import { PrismaClient } from '@prisma/client';
import { notFound, redirect } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import ShopOrderDetailClient from './ShopOrderDetailClient';

const prisma = new PrismaClient();

type Props = {
  params: Promise<{ locale: SupportedLocale; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, `shop/account/orders/${id}`, {
    title: resolvedLocale === 'ua' ? `Деталі замовлення ${id} | One Company` : `Order details ${id} | One Company`,
    description: resolvedLocale === 'ua' ? 'Перегляд деталей замовлення.' : 'View order details.',
  });
}

export default async function ShopOrderDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const session = await getCurrentShopCustomerSession();

  if (!session) {
    redirect(`/${locale}/shop/account/login?next=${encodeURIComponent(`/${locale}/shop/account/orders/${id}`)}`);
  }

  const order = await prisma.shopOrder.findFirst({
    where: { 
      orderNumber: id,
      customerId: session.customerId 
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    notFound();
  }

  const safeOrder = {
    ...order,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
    items: order.items.map(item => ({
      ...item,
      price: Number(item.price),
      total: Number(item.total),
    }))
  };

  return <ShopOrderDetailClient locale={locale} order={safeOrder as any} />;
}
