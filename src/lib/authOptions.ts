import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import {
  buildCustomerDisplayName,
  findCustomerAccountByEmail,
  markCustomerLogin,
  verifyShopCustomerPassword,
} from '@/lib/shopCustomers';
import { consumeRateLimit } from '@/lib/shopPublicRateLimit';
import { getRequiredEnv } from '@/lib/runtimeEnv';
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_PER_WINDOW = 12;

function getRequestIpFromNextAuthRequest(request: unknown) {
  const headers = (request as { headers?: Headers | Record<string, string | string[] | undefined> })?.headers;
  if (!headers) return 'unknown';
  if (typeof (headers as Headers).get === 'function') {
    const forwarded = (headers as Headers).get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
    return (headers as Headers).get('x-real-ip')?.trim() || 'unknown';
  }

  const forwarded = (headers as Record<string, string | string[] | undefined>)['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  const realIp = (headers as Record<string, string | string[] | undefined>)['x-real-ip'];
  return typeof realIp === 'string' && realIp.trim() ? realIp.trim() : 'unknown';
}

async function loadCurrentCustomerTokenState(customerId: string) {
  const customer = await prisma.shopCustomer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      isActive: true,
      group: true,
      b2bDiscountPercent: true,
      preferredLocale: true,
      companyName: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!customer || !customer.isActive) {
    return null;
  }

  return {
    customerId: customer.id,
    email: customer.email,
    name: buildCustomerDisplayName(customer),
    group: customer.group,
    b2bDiscountPercent: customer.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
    preferredLocale: customer.preferredLocale,
    companyName: customer.companyName ?? null,
    firstName: customer.firstName,
    lastName: customer.lastName,
  };
}

export const authOptions: NextAuthOptions = {
  secret: getRequiredEnv('NEXTAUTH_SECRET', 'dev-shop-customer-secret'),
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Customer credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');

        if (!email || !password) {
          return null;
        }

        if (
          !consumeRateLimit({
            keyParts: ['shop-login', getRequestIpFromNextAuthRequest(request), email],
            windowMs: LOGIN_WINDOW_MS,
            maxPerWindow: LOGIN_MAX_PER_WINDOW,
          })
        ) {
          return null;
        }

        const account = await findCustomerAccountByEmail(prisma, email);
        if (!account) {
          return null;
        }

        const isValid = await verifyShopCustomerPassword(password, account.passwordHash);
        if (!isValid) {
          return null;
        }

        await markCustomerLogin(prisma, account.customer.id);

        return {
          id: account.customer.id,
          email: account.customer.email,
          name: buildCustomerDisplayName(account.customer),
          customerId: account.customer.id,
          group: account.customer.group,
          b2bDiscountPercent: account.customer.b2bDiscountPercent != null ? Number(account.customer.b2bDiscountPercent) : null,
          preferredLocale: account.customer.preferredLocale,
          companyName: account.customer.companyName,
          firstName: account.customer.firstName,
          lastName: account.customer.lastName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.customerId = user.customerId;
        token.email = user.email;
        token.name = user.name;
        token.group = user.group;
        token.b2bDiscountPercent = user.b2bDiscountPercent ?? null;
        token.preferredLocale = user.preferredLocale;
        token.companyName = user.companyName ?? null;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        return token;
      }

      if (token.customerId) {
        const currentCustomer = await loadCurrentCustomerTokenState(String(token.customerId));
        if (!currentCustomer) {
          delete token.customerId;
          delete token.group;
          delete token.preferredLocale;
          delete token.b2bDiscountPercent;
          delete token.companyName;
          delete token.firstName;
          delete token.lastName;
          delete token.email;
          delete token.name;
          return token;
        }

        token.customerId = currentCustomer.customerId;
        token.email = currentCustomer.email;
        token.name = currentCustomer.name;
        token.group = currentCustomer.group;
        token.b2bDiscountPercent = currentCustomer.b2bDiscountPercent;
        token.preferredLocale = currentCustomer.preferredLocale;
        token.companyName = currentCustomer.companyName;
        token.firstName = currentCustomer.firstName;
        token.lastName = currentCustomer.lastName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.customerId && token.group) {
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
        session.user.customerId = token.customerId;
        session.user.group = token.group;
        session.user.b2bDiscountPercent = token.b2bDiscountPercent ?? null;
        session.user.preferredLocale = token.preferredLocale ?? 'en';
        session.user.companyName = token.companyName ?? null;
        session.user.firstName = token.firstName ?? '';
        session.user.lastName = token.lastName ?? '';
      }
      return session;
    },
  },
};
