import { Prisma, PrismaClient } from "@prisma/client";
import type { AdminSession } from "@/lib/adminAuth";
import { SUPERADMIN_ROLE_KEY } from "@/lib/admin/adminPermissions";

export {
  ADMIN_PERMISSIONS,
  ADMIN_ROLE_TEMPLATES,
  OWNER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
  getAdminRoleTemplate,
  type AdminPermission,
  type AdminRoleTemplate,
} from "@/lib/admin/adminPermissions";

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
    email: (process.env.ADMIN_EMAIL || "admin@onecompany.local").trim().toLowerCase(),
    name: (process.env.ADMIN_NAME || "One Company Admin").trim() || "One Company Admin",
  };
}

/**
 * Creates the one-time bootstrap owner only for an empty AdminUser table.
 * Existing users, activation state, and role assignments are never mutated.
 */
export async function createInitialAdminBootstrap(prisma: PrismaClient) {
  const identity = getBootstrapAdminIdentity();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    if ((await tx.adminUser.count()) > 0) {
      return null;
    }

    const role = await tx.adminRole.upsert({
      where: { key: SUPERADMIN_ROLE_KEY },
      create: {
        key: SUPERADMIN_ROLE_KEY,
        name: "Super Admin",
        permissions: ["*"],
      },
      update: {},
    });

    const user = await tx.adminUser.create({
      data: {
        email: identity.email,
        name: identity.name,
        isActive: true,
        lastLoginAt: now,
        roles: {
          create: {
            role: { connect: { id: role.id } },
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name || identity.name,
      permissions: ["*"],
    };
  });
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
