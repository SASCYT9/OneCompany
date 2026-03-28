import { CustomerGroup, Prisma, PrismaClient } from '@prisma/client';
import {
  buildCustomerDisplayName,
  getDefaultShippingAddress,
  serializeShopCustomerAdminListItem,
  shopCustomerAdminListSelect,
} from '@/lib/shopCustomers';

export const shopCustomerAdminDetailInclude = {
  account: true,
  addresses: {
    orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'asc' }],
  },
  orders: {
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      items: true,
    },
  },
  carts: {
    orderBy: { updatedAt: 'desc' },
    include: {
      items: true,
    },
    take: 10,
  },
} satisfies Prisma.ShopCustomerInclude;

export type ShopCustomerAdminDetailRecord = Prisma.ShopCustomerGetPayload<{
  include: typeof shopCustomerAdminDetailInclude;
}>;

export type ShopCustomerAdminAuditRecord = Prisma.AdminAuditLogGetPayload<{
  select: {
    id: true;
    actorEmail: true;
    actorName: true;
    action: true;
    metadata: true;
    createdAt: true;
  };
}>;

function nullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function nullablePercent(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  return Math.min(parsed, 100);
}

export function normalizeCustomerGroup(value: unknown): CustomerGroup {
  switch (String(value ?? '').trim()) {
    case 'B2B_PENDING':
      return 'B2B_PENDING';
    case 'B2B_APPROVED':
      return 'B2B_APPROVED';
    default:
      return 'B2C';
  }
}

export function serializeShopCustomerAdminDetail(
  record: ShopCustomerAdminDetailRecord,
  auditLogs: ShopCustomerAdminAuditRecord[]
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
    discountTier: (record as any).discountTier || 'none',
    region: (record as any).region || 'Unknown',
    currencyPref: (record as any).currencyPref || 'USD',
    balance: (record as any).balance ? parseFloat((record as any).balance.toString()) : 0,
    role: (record as any).role,
    isActive: record.isActive,
    notes: record.notes,
    preferredLocale: record.preferredLocale,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    account: record.account
      ? {
          lastLoginAt: record.account.lastLoginAt?.toISOString() ?? null,
          emailVerifiedAt: record.account.emailVerifiedAt?.toISOString() ?? null,
          plainPassword: (record.account as any).plainPassword ?? null,
        }
      : null,
    defaultShippingAddress: defaultShippingAddress
      ? {
          id: defaultShippingAddress.id,
          label: defaultShippingAddress.label,
          line1: defaultShippingAddress.line1,
          line2: defaultShippingAddress.line2,
          city: defaultShippingAddress.city,
          region: defaultShippingAddress.region,
          postcode: defaultShippingAddress.postcode,
          country: defaultShippingAddress.country,
          isDefaultShipping: defaultShippingAddress.isDefaultShipping,
          isDefaultBilling: defaultShippingAddress.isDefaultBilling,
        }
      : null,
    addresses: record.addresses.map((address) => ({
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
    })),
    orders: record.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
    carts: record.carts.map((cart) => ({
      id: cart.id,
      token: cart.token,
      currency: cart.currency,
      locale: cart.locale,
      updatedAt: cart.updatedAt.toISOString(),
      expiresAt: cart.expiresAt.toISOString(),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    })),
    auditLog: auditLogs.map((entry) => ({
      id: entry.id,
      actorEmail: entry.actorEmail,
      actorName: entry.actorName,
      action: entry.action,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export async function listShopCustomersAdmin(
  prisma: PrismaClient,
  input: {
    q?: string | null;
    group?: string | null;
    status?: string | null;
  } = {}
) {
  const q = String(input.q ?? '').trim();
  const group = String(input.group ?? '').trim();
  const status = String(input.status ?? '').trim().toLowerCase();

  const records = await prisma.shopCustomer.findMany({
    where: {
      ...(group && ['B2C', 'B2B_PENDING', 'B2B_APPROVED'].includes(group)
        ? { group: group as CustomerGroup }
        : {}),
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { companyName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: shopCustomerAdminListSelect,
  });

  return records.map(serializeShopCustomerAdminListItem);
}

export async function getShopCustomerAdminDetail(prisma: PrismaClient, customerId: string) {
  const record = await prisma.shopCustomer.findUnique({
    where: { id: customerId },
    include: shopCustomerAdminDetailInclude,
  });

  if (!record) {
    return null;
  }

  const auditLogs = await prisma.adminAuditLog.findMany({
    where: {
      scope: 'shop',
      OR: [
        { entityType: 'shop.customer', entityId: customerId },
        { actorEmail: record.email },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      actorEmail: true,
      actorName: true,
      action: true,
      metadata: true,
      createdAt: true,
    },
  });

  return serializeShopCustomerAdminDetail(record, auditLogs);
}

export function normalizeShopCustomerAdminPayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  return {
    firstName: String(source.firstName ?? '').trim(),
    lastName: String(source.lastName ?? '').trim(),
    phone: nullableString(source.phone),
    companyName: nullableString(source.companyName),
    vatNumber: nullableString(source.vatNumber),
    notes: nullableString(source.notes),
    b2bDiscountPercent: nullablePercent(source.b2bDiscountPercent),
    discountTier: nullableString(source.discountTier),
    region: nullableString(source.region),
    currencyPref: String(source.currencyPref || 'EUR').toUpperCase(),
    balance: typeof source.balance === 'number' ? source.balance : (nullableString(source.balance) !== null ? Number(source.balance) : 0),
    preferredLocale: String(source.preferredLocale ?? '').trim() === 'ua' ? 'ua' : 'en',
    isActive: source.isActive !== false,
    group: normalizeCustomerGroup(source.group),
  };
}
