import crypto from 'crypto';
import { promisify } from 'util';
import { CustomerGroup, Prisma, PrismaClient } from '@prisma/client';

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_SETUP_TTL_MS = 1000 * 60 * 60 * 24 * 3;

export const shopCustomerProfileInclude = {
  account: true,
  addresses: {
    orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'asc' }],
  },
  orders: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      items: true,
    },
  },
} satisfies Prisma.ShopCustomerInclude;

/** For account/cabinet: load customer without orders; use getOrdersForCustomerDisplay for full list (incl. guest by email). */
export const shopCustomerProfileIncludeWithoutOrders = {
  account: true,
  addresses: {
    orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ShopCustomerInclude;

export const shopCustomerAdminListSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  companyName: true,
  group: true,
  b2bDiscountPercent: true,
  // discountTier: true,
  // region: true,
  // currencyPref: true,
  isActive: true,
  preferredLocale: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      orders: true,
      carts: true,
      addresses: true,
    },
  },
} satisfies Prisma.ShopCustomerSelect;

export type ShopCustomerProfileRecord = Prisma.ShopCustomerGetPayload<{
  include: typeof shopCustomerProfileInclude;
}>;

export type ShopCustomerProfileBaseRecord = Prisma.ShopCustomerGetPayload<{
  include: typeof shopCustomerProfileIncludeWithoutOrders;
}>;

/** All orders to show in cabinet: linked by customerId + guest orders with same email (case-insensitive). Sorted by createdAt desc. */
export async function getOrdersForCustomerDisplay(
  prisma: PrismaClient,
  customerId: string,
  customerEmail: string
) {
  const email = normalizeCustomerEmail(customerEmail);
  return prisma.shopOrder.findMany({
    where: {
      OR: [
        { customerId },
        { customerId: null, email: { equals: email, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });
}

export type ShopCustomerAdminListRecord = Prisma.ShopCustomerGetPayload<{
  select: typeof shopCustomerAdminListSelect;
}>;

export type ShopCustomerRegistrationInput = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string | null;
  preferredLocale?: string | null;
  currencyPref?: string | null;
};

type CustomerAddressSnapshot = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string | null;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

function nullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function normalizeCustomerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function buildCustomerDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const fullName = [input.firstName, input.lastName]
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .join(' ');

  return fullName || String(input.email ?? '').trim() || 'Customer';
}

export async function hashShopCustomerPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `s1:${salt}:${derived.toString('hex')}`;
}

export async function verifyShopCustomerPassword(password: string, passwordHash: string) {
  const [version, salt, expected] = String(passwordHash).split(':');
  if (version !== 's1' || !salt || !expected) {
    return false;
  }

  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== derived.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expectedBuffer);
}

export function getDefaultShippingAddress(addresses: Array<{
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string | null;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}>) {
  return (
    addresses.find((address) => address.isDefaultShipping) ??
    addresses[0] ??
    null
  );
}

export async function createShopCustomerRegistration(
  prisma: PrismaClient,
  input: ShopCustomerRegistrationInput
) {
  const email = normalizeCustomerEmail(input.email);
  const existing = await prisma.shopCustomer.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new Error('CUSTOMER_EXISTS');
  }

  const passwordHash = await hashShopCustomerPassword(input.password);
  return prisma.shopCustomer.create({
    data: {
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: nullableString(input.phone),
      preferredLocale: nullableString(input.preferredLocale) ?? 'en',
      // currencyPref: input.currencyPref || 'EUR',
      group: 'B2C',
      account: {
        create: {
          passwordHash,
        },
      },
    },
    include: {
      account: true,
      addresses: true,
    },
  });
}

export async function findCustomerAccountByEmail(prisma: PrismaClient, email: string) {
  // NOTE: we deliberately do NOT filter on `isActive` here so callers can
  // distinguish between "no such account" (return null) and "account is
  // disabled" (return record + customer.isActive === false). Login flow uses
  // that distinction to surface a specific error code.
  return prisma.shopCustomerAccount.findFirst({
    where: {
      customer: {
        email: normalizeCustomerEmail(email),
      },
    },
    include: {
      customer: true,
    },
  });
}

function hashPasswordSetupToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createShopCustomerPasswordSetup(
  prisma: PrismaClient,
  input: {
    customerId: string;
    preferredLocale?: string | null;
  }
) {
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashPasswordSetupToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);
  const locale = String(input.preferredLocale ?? '').trim() === 'ua' ? 'ua' : 'en';
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const path = `/${locale}/shop/account/setup-password?token=${encodeURIComponent(rawToken)}`;

  await prisma.shopCustomerPasswordSetupToken.upsert({
    where: { customerId: input.customerId },
    create: {
      customerId: input.customerId,
      tokenHash,
      expiresAt,
    },
    update: {
      tokenHash,
      expiresAt,
    },
  });

  return {
    url: baseUrl ? `${baseUrl}${path}` : path,
    expiresAt,
  };
}

export async function consumeShopCustomerPasswordSetup(
  prisma: PrismaClient,
  input: {
    token: string;
    password: string;
  }
) {
  const tokenHash = hashPasswordSetupToken(input.token);
  const setupToken = await prisma.shopCustomerPasswordSetupToken.findUnique({
    where: { tokenHash },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!setupToken || setupToken.expiresAt.getTime() <= Date.now()) {
    throw new Error('TOKEN_INVALID');
  }

  const passwordHash = await hashShopCustomerPassword(input.password);
  const now = new Date();

  await prisma.$transaction([
    prisma.shopCustomerAccount.upsert({
      where: { customerId: setupToken.customerId },
      create: {
        customerId: setupToken.customerId,
        passwordHash,
        emailVerifiedAt: now,
      },
      update: {
        passwordHash,
        emailVerifiedAt: now,
      },
    }),
    prisma.shopCustomerPasswordSetupToken.delete({
      where: { customerId: setupToken.customerId },
    }),
    prisma.shopCustomer.update({
      where: { id: setupToken.customerId },
      data: { updatedAt: now },
    }),
  ]);

  return setupToken.customer;
}

export async function markCustomerLogin(prisma: PrismaClient, customerId: string) {
  const now = new Date();
  await prisma.shopCustomerAccount.update({
    where: { customerId },
    data: {
      lastLoginAt: now,
    },
  });
  await prisma.shopCustomer.update({
    where: { id: customerId },
    data: {
      updatedAt: now,
    },
  });
}

export async function applyCustomerB2BRequest(prisma: PrismaClient, customerId: string) {
  const customer = await prisma.shopCustomer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      group: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });

  if (!customer) {
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  if (customer.group === 'B2B_APPROVED') {
    throw new Error('CUSTOMER_ALREADY_APPROVED');
  }

  if (customer.group === 'B2B_PENDING') {
    return customer;
  }

  return prisma.shopCustomer.update({
    where: { id: customer.id },
    data: {
      group: 'B2B_PENDING',
    },
    select: {
      id: true,
      group: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
    },
  });
}

export async function approveCustomerB2B(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomer.update({
    where: { id: customerId },
    data: { group: 'B2B_APPROVED' },
  });
}

export async function archiveShopCustomer(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomer.update({
    where: { id: customerId },
    data: { archivedAt: new Date(), isActive: false },
  });
}

export async function restoreShopCustomer(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomer.update({
    where: { id: customerId },
    data: { archivedAt: null, isActive: true },
  });
}

export async function revertCustomerToB2C(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomer.update({
    where: { id: customerId },
    data: { group: 'B2C' },
  });
}

export async function upsertCustomerDefaultShippingAddress(
  prisma: PrismaClient,
  customerId: string,
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    region?: string | null;
    postcode?: string | null;
    country: string;
  }
) {
  const existing = await prisma.shopCustomerAddress.findFirst({
    where: {
      customerId,
      isDefaultShipping: true,
    },
    select: { id: true },
  });

  await prisma.shopCustomerAddress.updateMany({
    where: { customerId },
    data: {
      isDefaultShipping: false,
    },
  });

  if (existing) {
    return prisma.shopCustomerAddress.update({
      where: { id: existing.id },
      data: {
        label: 'Shipping',
        line1: address.line1,
        line2: nullableString(address.line2),
        city: address.city,
        region: nullableString(address.region),
        postcode: nullableString(address.postcode),
        country: address.country,
        isDefaultShipping: true,
      },
    });
  }

  return prisma.shopCustomerAddress.create({
    data: {
      customerId,
      label: 'Shipping',
      line1: address.line1,
      line2: nullableString(address.line2),
      city: address.city,
      region: nullableString(address.region),
      postcode: nullableString(address.postcode),
      country: address.country,
      isDefaultShipping: true,
    },
  });
}

/**
 * Address CRUD helpers used by both `/shop/account/addresses` cabinet page
 * and `/admin/shop/customers` admin detail. All accept `customerId` as a
 * mandatory ownership guard — never expose by id alone.
 */

type AddressInput = {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postcode?: string | null;
  country: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

function sanitizeAddressInput(input: AddressInput) {
  const line1 = String(input.line1 ?? '').trim();
  const city = String(input.city ?? '').trim();
  const country = String(input.country ?? '').trim();
  if (!line1 || !city || !country) {
    throw new Error('ADDRESS_MISSING_REQUIRED_FIELDS');
  }
  return {
    label: nullableString(input.label) ?? 'Shipping',
    line1,
    line2: nullableString(input.line2),
    city,
    region: nullableString(input.region),
    postcode: nullableString(input.postcode),
    country,
    isDefaultShipping: Boolean(input.isDefaultShipping),
    isDefaultBilling: Boolean(input.isDefaultBilling),
  };
}

export async function listShopCustomerAddresses(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefaultShipping: 'desc' }, { isDefaultBilling: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function createShopCustomerAddress(
  prisma: PrismaClient,
  customerId: string,
  input: AddressInput,
) {
  const data = sanitizeAddressInput(input);

  return prisma.$transaction(async (tx) => {
    if (data.isDefaultShipping) {
      await tx.shopCustomerAddress.updateMany({
        where: { customerId, isDefaultShipping: true },
        data: { isDefaultShipping: false },
      });
    }
    if (data.isDefaultBilling) {
      await tx.shopCustomerAddress.updateMany({
        where: { customerId, isDefaultBilling: true },
        data: { isDefaultBilling: false },
      });
    }
    return tx.shopCustomerAddress.create({
      data: { customerId, ...data },
    });
  });
}

export async function updateShopCustomerAddress(
  prisma: PrismaClient,
  customerId: string,
  addressId: string,
  input: AddressInput,
) {
  const owned = await prisma.shopCustomerAddress.findFirst({
    where: { id: addressId, customerId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error('ADDRESS_NOT_FOUND');
  }
  const data = sanitizeAddressInput(input);

  return prisma.$transaction(async (tx) => {
    if (data.isDefaultShipping) {
      await tx.shopCustomerAddress.updateMany({
        where: { customerId, isDefaultShipping: true, NOT: { id: addressId } },
        data: { isDefaultShipping: false },
      });
    }
    if (data.isDefaultBilling) {
      await tx.shopCustomerAddress.updateMany({
        where: { customerId, isDefaultBilling: true, NOT: { id: addressId } },
        data: { isDefaultBilling: false },
      });
    }
    return tx.shopCustomerAddress.update({
      where: { id: addressId },
      data,
    });
  });
}

export async function deleteShopCustomerAddress(
  prisma: PrismaClient,
  customerId: string,
  addressId: string,
) {
  const owned = await prisma.shopCustomerAddress.findFirst({
    where: { id: addressId, customerId },
    select: { id: true },
  });
  if (!owned) {
    throw new Error('ADDRESS_NOT_FOUND');
  }
  await prisma.shopCustomerAddress.delete({ where: { id: addressId } });
}

function serializeAddress(address: {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string | null;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}): CustomerAddressSnapshot {
  return {
    id: address.id,
    label: address.label,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postcode: address.postcode,
    country: address.country,
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  };
}

export function serializeShopCustomerProfile(
  record: Omit<ShopCustomerProfileRecord, 'orders'> & { orders: ShopCustomerProfileRecord['orders'] }
) {
  const defaultShippingAddress = getDefaultShippingAddress(record.addresses);

  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: buildCustomerDisplayName(record),
    phone: record.phone,
    companyName: record.companyName,
    vatNumber: record.vatNumber,
    group: record.group,
    b2bDiscountPercent: record.b2bDiscountPercent != null ? Number(record.b2bDiscountPercent) : null,
    isActive: record.isActive,
    notes: record.notes,
    preferredLocale: record.preferredLocale,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    account: record.account
      ? {
          lastLoginAt: record.account.lastLoginAt?.toISOString() ?? null,
          emailVerifiedAt: record.account.emailVerifiedAt?.toISOString() ?? null,
        }
      : null,
    defaultShippingAddress: defaultShippingAddress ? serializeAddress(defaultShippingAddress) : null,
    addresses: record.addresses.map(serializeAddress),
    orders: record.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      previewItem: order.items[0]
        ? {
            title: order.items[0].title,
            image: order.items[0].image ?? null,
          }
        : null,
    })),
  };
}

export function serializeShopCustomerAdminListItem(record: ShopCustomerAdminListRecord) {
  return {
    id: record.id,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: buildCustomerDisplayName(record),
    phone: record.phone,
    companyName: record.companyName,
    group: record.group,
    b2bDiscountPercent: record.b2bDiscountPercent != null ? Number(record.b2bDiscountPercent) : null,
    isActive: record.isActive,
    preferredLocale: record.preferredLocale,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    counts: {
      orders: record._count.orders,
      carts: record._count.carts,
      addresses: record._count.addresses,
    },
  };
}

export function isB2BApprovedGroup(group: CustomerGroup | null | undefined) {
  return group === 'B2B_APPROVED';
}
