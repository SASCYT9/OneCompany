import { redirect } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { buildNoIndexPageMetadata, resolveLocale } from '@/lib/seo';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { listShopCustomerAddresses } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';
import ShopAddressesClient from './ShopAddressesClient';

type Props = {
  params: Promise<{ locale: SupportedLocale }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildNoIndexPageMetadata(resolvedLocale, 'shop/account/addresses', {
    title: resolvedLocale === 'ua' ? 'Мої адреси | One Company' : 'My addresses | One Company',
    description:
      resolvedLocale === 'ua'
        ? 'Керування адресами доставки та виставлення рахунків.'
        : 'Manage your shipping and billing addresses.',
  });
}

export default async function ShopAccountAddressesPage({ params }: Props) {
  const { locale } = await params;
  const session = await getCurrentShopCustomerSession();

  if (!session) {
    redirect(`/${locale}/shop/account/login?next=${encodeURIComponent(`/${locale}/shop/account/addresses`)}`);
  }

  const addresses = await listShopCustomerAddresses(prisma, session.customerId);

  return (
    <ShopAddressesClient
      locale={locale}
      initialAddresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        region: a.region,
        postcode: a.postcode,
        country: a.country,
        isDefaultShipping: a.isDefaultShipping,
        isDefaultBilling: a.isDefaultBilling,
      }))}
    />
  );
}
