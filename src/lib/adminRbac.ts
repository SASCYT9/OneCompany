import { Prisma, PrismaClient } from '@prisma/client';
import type { AdminSession } from '@/lib/adminAuth';

export const ADMIN_PERMISSIONS = {
  SHOP_PRODUCTS_READ: 'shop.products.read',
  SHOP_PRODUCTS_WRITE: 'shop.products.write',
  SHOP_CUSTOMERS_READ: 'shop.customers.read',
  SHOP_CUSTOMERS_WRITE: 'shop.customers.write',
  SHOP_CATEGORIES_READ: 'shop.categories.read',
  SHOP_CATEGORIES_WRITE: 'shop.categories.write',
  SHOP_COLLECTIONS_READ: 'shop.collections.read',
  SHOP_COLLECTIONS_WRITE: 'shop.collections.write',
  SHOP_IMPORTS_MANAGE: 'shop.imports.manage',
  SHOP_PRICING_READ: 'shop.pricing.read',
  SHOP_PRICING_WRITE: 'shop.pricing.write',
  SHOP_INVENTORY_READ: 'shop.inventory.read',
  SHOP_INVENTORY_WRITE: 'shop.inventory.write',
  SHOP_ORDERS_READ: 'shop.orders.read',
  SHOP_ORDERS_WRITE: 'shop.orders.write',
  SHOP_SETTINGS_READ: 'shop.settings.read',
  SHOP_SETTINGS_WRITE: 'shop.settings.write',
  SHOP_AUDIT_READ: 'shop.audit.read',
} as const;

export const SUPERADMIN_ROLE_KEY = 'superadmin';

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

type BootstrapAdminIdentity = {
  email: string;
  name: string;
};

type AuditEntry = {
  scope: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type AdminAuditClient = PrismaClient | Prisma.TransactionClient;

function getBootstrapAdminIdentity(): BootstrapAdminIdentity {
  return {
    email: (process.env.ADMIN_EMAIL || 'admin@onecompany.local').trim().toLowerCase(),
    name: (process.env.ADMIN_NAME || 'One Company Admin').trim() || 'One Company Admin',
  };
}

export async function ensureAdminBootstrap(prisma: PrismaClient) {
  const identity = getBootstrapAdminIdentity();
  const now = new Date();

  const role = await prisma.adminRole.upsert({
    where: { key: SUPERADMIN_ROLE_KEY },
    create: {
      key: SUPERADMIN_ROLE_KEY,
      name: 'Super Admin',
      permissions: ['*'],
    },
    update: {
      name: 'Super Admin',
      permissions: ['*'],
    },
  });

  const user = await prisma.adminUser.upsert({
    where: { email: identity.email },
    create: {
      email: identity.email,
      name: identity.name,
      isActive: true,
      lastLoginAt: now,
    },
    update: {
      name: identity.name,
      isActive: true,
      lastLoginAt: now,
    },
  });

  await prisma.adminUserRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      userId: user.id,
      roleId: role.id,
    },
    update: {},
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions: ['*'],
  };
}

export async function writeAdminAuditLog(
  prisma: AdminAuditClient,
  session: AdminSession,
  entry: AuditEntry
) {
  const actor = await prisma.adminUser.findUnique({
    where: { email: session.email },
    select: { id: true },
  });

  return prisma.adminAuditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorEmail: session.email,
      actorName: session.name,
      scope: entry.scope,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
