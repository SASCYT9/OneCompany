import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  buildCustomerDisplayName,
  findCustomerAccountByEmail,
  markCustomerLogin,
  verifyShopCustomerPassword,
} from '@/lib/shopCustomers';
import { consumeRateLimit } from '@/lib/shopPublicRateLimit';
import { prisma } from '@/lib/prisma';

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_PER_WINDOW = 12;
const NEXTAUTH_SECRET = (process.env.NEXTAUTH_SECRET || '').trim();

if (process.env.NODE_ENV === 'production' && !NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is required in production');
}

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
      b2bDiscountPercent: true,
      preferredLocale: true,
      companyName: true,
      vatNumber: true,
      firstName: true,
      lastName: true,
      group: true,
    },
  });

  if (!customer) {
    return null;
  }

  return {
    customerId: customer.id,
    email: customer.email,
    name: buildCustomerDisplayName(customer),
    group: customer.group,
    b2bDiscountPercent: customer.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
    discountTier: null as any, // Removed from select, setting to null
    currencyPref: 'USD' as any, // Removed from select, setting to default
    balance: 0,
    preferredLocale: customer.preferredLocale,
    companyName: customer.companyName ?? null,
    firstName: customer.firstName,
    lastName: customer.lastName,
  };
}

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET || 'dev-shop-customer-secret',
  pages: {
    signIn: '/en/shop/account/login',
    error: '/en/shop/account/login',
  },
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
          !(await consumeRateLimit({
            keyParts: ['shop-login', getRequestIpFromNextAuthRequest(request), email],
            windowMs: LOGIN_WINDOW_MS,
            maxPerWindow: LOGIN_MAX_PER_WINDOW,
          }))
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

        if (!account.customer.isActive) {
          // Distinct error code so the login UI can show a clear message instead
          // of the generic "invalid credentials" copy.
          throw new Error('ACCOUNT_DISABLED');
        }

        await markCustomerLogin(prisma, account.customer.id);

        // Assuming account.customer now has 'role' instead of 'group'
        // and other properties like discountTier, currencyPref are not directly available
        return {
          id: account.customer.id,
          email: account.customer.email,
          name: buildCustomerDisplayName(account.customer),
          customerId: account.customer.id,
          group: account.customer.group,
          b2bDiscountPercent: account.customer.b2bDiscountPercent != null ? Number(account.customer.b2bDiscountPercent) : null,
          discountTier: null, // Removed from account.customer, setting to null
          currencyPref: 'USD', // Removed from account.customer, setting to default
          balance: 0,
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
        token.discountTier = user.discountTier ?? null;
        token.currencyPref = user.currencyPref ?? 'EUR';
        token.balance = user.balance ?? 0;
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
          delete token.discountTier;
          delete token.currencyPref;
          delete token.balance;
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
        token.discountTier = currentCustomer.discountTier;
        token.currencyPref = currentCustomer.currencyPref;
        token.balance = currentCustomer.balance;
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
        session.user.discountTier = token.discountTier ?? null;
        session.user.currencyPref = token.currencyPref ?? 'EUR';
        session.user.balance = token.balance ?? 0;
        session.user.preferredLocale = token.preferredLocale ?? 'en';
        session.user.companyName = token.companyName ?? null;
        session.user.firstName = token.firstName ?? '';
        session.user.lastName = token.lastName ?? '';
      }
      return session;
    },
  },
};
