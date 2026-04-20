import type { Prisma } from '@prisma/client';

const MAX_ADMIN_USER_NAME_LENGTH = 120;

export type SerializedAdminUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    key: string;
    name: string;
  }>;
};

export type AdminUserWithRoles = Prisma.AdminUserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

export const adminUserWithRolesInclude = {
  roles: {
    include: {
      role: true,
    },
  },
} satisfies Prisma.AdminUserInclude;

type NormalizedAdminUserPatch = {
  name?: string | null;
  isActive?: boolean;
  roleIds?: string[];
};

function normalizeAdminUserName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, MAX_ADMIN_USER_NAME_LENGTH);
  return trimmed || null;
}

export function normalizeAdminRoleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return { ok: false as const, error: 'roleIds must be an array of strings' };
  }

  const seen = new Set<string>();
  const roleIds: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      return { ok: false as const, error: 'roleIds must be an array of strings' };
    }

    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    roleIds.push(normalized);
  }

  return { ok: true as const, value: roleIds };
}

export function normalizeAdminUserPatchPayload(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false as const, error: 'Invalid request body' };
  }

  const payload = body as Record<string, unknown>;
  const normalized: NormalizedAdminUserPatch = {};
  const updatedFields: string[] = [];

  if ('name' in payload) {
    if (typeof payload.name !== 'string') {
      return { ok: false as const, error: 'name must be a string' };
    }
    normalized.name = normalizeAdminUserName(payload.name);
    updatedFields.push('name');
  }

  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') {
      return { ok: false as const, error: 'isActive must be a boolean' };
    }
    normalized.isActive = payload.isActive;
    updatedFields.push('isActive');
  }

  if ('roleIds' in payload) {
    const normalizedRoleIds = normalizeAdminRoleIds(payload.roleIds);
    if (!normalizedRoleIds.ok) {
      return normalizedRoleIds;
    }
    normalized.roleIds = normalizedRoleIds.value;
    updatedFields.push('roleIds');
  }

  if (!updatedFields.length) {
    return { ok: false as const, error: 'No valid fields to update' };
  }

  return {
    ok: true as const,
    value: normalized,
    updatedFields,
  };
}

export function determineAdminUserAuditAction(previousIsActive: boolean, nextIsActive: boolean, updatedFields: string[]) {
  if (updatedFields.includes('isActive') && previousIsActive !== nextIsActive) {
    return nextIsActive ? 'admin.user.activate' : 'admin.user.deactivate';
  }

  return 'admin.user.update';
}

export function serializeAdminUser(user: AdminUserWithRoles): SerializedAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles.map(({ role }) => ({
      id: role.id,
      key: role.key,
      name: role.name,
    })),
  };
}
