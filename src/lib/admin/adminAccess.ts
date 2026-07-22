import { cache } from "react";
import { cookies } from "next/headers";

import { getAdminSession, type AdminSession } from "@/lib/adminAuth";
import { matchesAdminPermission } from "@/lib/admin/adminPermissions";
import {
  resolveAdminIdentityFromSession,
  type AdminIdentityRepository,
  type AdminIdentityUserRecord,
} from "@/lib/admin/adminIdentity";

export type CurrentAdminAccess = {
  id: string;
  email: string;
  name: string;
  permissions: string[];
  roleKeys: string[];
  isOwner: boolean;
};

export type AdminAccessUserRecord = AdminIdentityUserRecord;
export type AdminAccessRepository = AdminIdentityRepository;

/**
 * Resolves authorization from the current database state. Cookie permissions are
 * deliberately ignored: the cookie proves the signed identity, while active
 * state and roles remain revocable on the next server request.
 */
export async function resolveAdminAccessFromSession(
  session: AdminSession | null,
  repository?: AdminAccessRepository
): Promise<CurrentAdminAccess | null> {
  return resolveAdminIdentityFromSession(session, repository);
}

const getCurrentAdminAccessCached = cache(async (): Promise<CurrentAdminAccess | null> => {
  const cookieStore = await cookies();
  const session = getAdminSession(cookieStore);
  return resolveAdminAccessFromSession(session);
});

/**
 * Request-local memoized access resolver for Server Components and Route
 * Handlers. It performs one active-user + role lookup per request.
 */
export async function getCurrentAdminAccess(): Promise<CurrentAdminAccess | null> {
  return getCurrentAdminAccessCached();
}

export function currentAdminHasPermission(
  access: Pick<CurrentAdminAccess, "permissions"> | null,
  requiredPermission: string
) {
  return Boolean(access && matchesAdminPermission(access.permissions, requiredPermission));
}

export function currentAdminHasAnyPermission(
  access: Pick<CurrentAdminAccess, "permissions"> | null,
  requiredPermissions: readonly string[]
) {
  return requiredPermissions.some((permission) => currentAdminHasPermission(access, permission));
}

export async function assertCurrentAdminAccess(
  requiredPermission?: string
): Promise<CurrentAdminAccess> {
  const access = await getCurrentAdminAccess();
  if (!access) {
    throw new Error("UNAUTHORIZED");
  }

  if (requiredPermission && !matchesAdminPermission(access.permissions, requiredPermission)) {
    throw new Error("FORBIDDEN");
  }

  return access;
}

export async function assertCurrentAdminAnyPermission(
  requiredPermissions: readonly string[]
): Promise<CurrentAdminAccess> {
  const access = await assertCurrentAdminAccess();
  if (
    requiredPermissions.length === 0 ||
    !currentAdminHasAnyPermission(access, requiredPermissions)
  ) {
    throw new Error("FORBIDDEN");
  }
  return access;
}
