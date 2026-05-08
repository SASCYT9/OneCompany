import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { CustomerGroup } from '@prisma/client';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import {
  SHOP_IMPERSONATION_COOKIE,
  verifyImpersonationToken,
} from '@/lib/shopImpersonation';

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
  /** Set when an admin is browsing as this customer via impersonation. */
  impersonator: { email: string; name: string } | null;
};

function isExpectedStaticGenerationSessionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const nextErrorCode = (error as { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE;
  const digest = (error as { digest?: string }).digest;
  const message = error instanceof Error ? error.message : String(error);

  return (
    nextErrorCode === 'DYNAMIC_SERVER_USAGE' ||
    digest === 'DYNAMIC_SERVER_USAGE' ||
    message.includes('Dynamic server usage') ||
    message.includes('used `headers()`')
  );
}

async function tryResolveImpersonatedSession(): Promise<ShopCustomerSession | null> {
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch (error) {
    if (isExpectedStaticGenerationSessionError(error)) return null;
    return null;
  }
  const token = cookieStore.get(SHOP_IMPERSONATION_COOKIE)?.value;
  const payload = verifyImpersonationToken(token);
  if (!payload) return null;

  const customer = await prisma.shopCustomer.findUnique({
    where: { id: payload.customerId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      group: true,
      b2bDiscountPercent: true,
      preferredLocale: true,
      companyName: true,
    },
  });
  if (!customer) return null;

  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return {
    customerId: customer.id,
    email: customer.email,
    name: fullName || customer.email,
    group: customer.group,
    b2bDiscountPercent: customer.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
    discountTier: null,
    currencyPref: 'EUR',
    balance: 0,
    preferredLocale: customer.preferredLocale,
    companyName: customer.companyName,
    firstName: customer.firstName,
    lastName: customer.lastName,
    impersonator: { email: payload.adminEmail, name: payload.adminName },
  };
}

export async function getCurrentShopCustomerSession(): Promise<ShopCustomerSession | null> {
  // Impersonation cookie wins over the regular customer session so the admin
  // can always exit cleanly back to their own context.
  const impersonated = await tryResolveImpersonatedSession();
  if (impersonated) return impersonated;

  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    if (isExpectedStaticGenerationSessionError(error)) {
      return null;
    }
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
    impersonator: null,
  };
}

export async function assertCurrentShopCustomerSession() {
  const session = await getCurrentShopCustomerSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
