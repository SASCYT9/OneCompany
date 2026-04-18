import { getServerSession } from 'next-auth';
import { CustomerGroup } from '@prisma/client';
import { authOptions } from '@/lib/authOptions';

export type ShopCustomerSession = {
  customerId: string;
  email: string;
  name: string;
  group: CustomerGroup;
  b2bDiscountPercent: number | null;
  discountTier: string | null;
  currencyPref: string;
  balance: number;
  preferredLocale: string;
  companyName: string | null;
  firstName: string;
  lastName: string;
};

export async function getCurrentShopCustomerSession(): Promise<ShopCustomerSession | null> {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error('Shop customer session resolve failed', error);
    return null;
  }

  if (!session?.user?.email || !session.user.customerId || !session.user.group) {
    return null;
  }

  return {
    customerId: session.user.customerId,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
    group: session.user.group,
    b2bDiscountPercent: session.user.b2bDiscountPercent ?? null,
    discountTier: session.user.discountTier ?? null,
    currencyPref: session.user.currencyPref ?? 'EUR',
    balance: session.user.balance ?? 0,
    preferredLocale: session.user.preferredLocale ?? 'en',
    companyName: session.user.companyName ?? null,
    firstName: session.user.firstName ?? '',
    lastName: session.user.lastName ?? '',
  };
}

export async function assertCurrentShopCustomerSession() {
  const session = await getCurrentShopCustomerSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
