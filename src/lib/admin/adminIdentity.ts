import type { AdminSession } from "@/lib/adminAuth";
import { OWNER_ROLE_KEY, SUPERADMIN_ROLE_KEY } from "@/lib/admin/adminPermissions";

export type AdminIdentityUserRecord = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  roles: Array<{
    role: {
      key: string;
      permissions: string[];
    };
  }>;
};

export type AdminIdentityRepository = {
  findActiveByEmail: (email: string) => Promise<AdminIdentityUserRecord | null>;
};

export type ResolvedAdminIdentity = {
  id: string;
  email: string;
  name: string;
  permissions: string[];
  roleKeys: string[];
  isOwner: boolean;
};

export const prismaAdminIdentityRepository: AdminIdentityRepository = {
  async findActiveByEmail(email) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.adminUser.findFirst({
      where: {
        email,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: true,
              },
            },
          },
        },
      },
    });
  },
};

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/**
 * The signed cookie proves identity only. Active state and authorization are
 * always resolved from PostgreSQL so revocation takes effect on the next
 * request without waiting for the cookie to expire.
 */
export async function resolveAdminIdentityFromSession(
  session: AdminSession | null,
  repository: AdminIdentityRepository = prismaAdminIdentityRepository
): Promise<ResolvedAdminIdentity | null> {
  if (!session?.email) {
    return null;
  }

  const user = await repository.findActiveByEmail(session.email.trim().toLowerCase());
  if (!user?.isActive) {
    return null;
  }

  const roleKeys = uniqueStrings(user.roles.map(({ role }) => role.key));
  const permissions = uniqueStrings(user.roles.flatMap(({ role }) => role.permissions));
  const isOwner =
    permissions.includes("*") ||
    roleKeys.includes(OWNER_ROLE_KEY) ||
    roleKeys.includes(SUPERADMIN_ROLE_KEY);

  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    name: user.name?.trim() || session.name || "Admin",
    permissions: isOwner ? ["*"] : permissions,
    roleKeys,
    isOwner,
  };
}

export async function resolveCurrentAdminSession(
  signedSession: AdminSession | null,
  repository: AdminIdentityRepository = prismaAdminIdentityRepository
): Promise<AdminSession | null> {
  if (!signedSession) {
    return null;
  }

  const identity = await resolveAdminIdentityFromSession(signedSession, repository);
  if (!identity) {
    return null;
  }

  return {
    email: identity.email,
    name: identity.name,
    permissions: identity.permissions,
    issuedAt: signedSession.issuedAt,
    nonce: signedSession.nonce,
  };
}
