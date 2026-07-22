import type { Prisma } from "@prisma/client";

const MAX_ADMIN_USER_NAME_LENGTH = 120;

export type SerializedAdminUser = {
  id: string;
  email: string;
  name: string | null;
  hasPassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  opsProfile: {
    telegramUserId: string | null;
    telegramEnabled: boolean;
    timezone: string;
  } | null;
};

export type AdminUserWithRoles = Prisma.AdminUserGetPayload<{
  include: {
    roles: {
      include: {
        role: true;
      };
    };
    opsProfile: true;
  };
}>;

export const adminUserWithRolesInclude = {
  roles: {
    include: {
      role: true,
    },
  },
  opsProfile: true,
} satisfies Prisma.AdminUserInclude;

type NormalizedAdminUserPatch = {
  email?: string;
  name?: string | null;
  password?: string;
  isActive?: boolean;
  roleIds?: string[];
  opsProfile?: NormalizedOpsMemberProfile;
};

export type NormalizedOpsMemberProfile = {
  telegramUserId: bigint | null;
  telegramEnabled: boolean;
  timezone: string;
};

const DEFAULT_OPS_TIMEZONE = "Europe/Kyiv";
const MAX_TELEGRAM_USER_ID = BigInt("9223372036854775807");
export const MIN_ADMIN_PASSWORD_LENGTH = 12;
export const MAX_ADMIN_PASSWORD_LENGTH = 256;

export function normalizeAdminEmail(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false as const, error: "email must be a string" };
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid email address" };
  }

  return { ok: true as const, value: email };
}

export function normalizeAdminPassword(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false as const, error: "password must be a string" };
  }

  if (value.length < MIN_ADMIN_PASSWORD_LENGTH || value.length > MAX_ADMIN_PASSWORD_LENGTH) {
    return {
      ok: false as const,
      error: `password must be between ${MIN_ADMIN_PASSWORD_LENGTH} and ${MAX_ADMIN_PASSWORD_LENGTH} characters`,
    };
  }

  return { ok: true as const, value };
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeOpsMemberProfilePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "opsProfile must be an object" };
  }

  const source = value as Record<string, unknown>;
  const rawTelegramUserId = source.telegramUserId;
  let telegramUserId: bigint | null = null;

  if (rawTelegramUserId !== null && rawTelegramUserId !== undefined && rawTelegramUserId !== "") {
    const normalized = String(rawTelegramUserId).trim();
    if (!/^\d+$/.test(normalized)) {
      return { ok: false as const, error: "telegramUserId must be a positive integer string" };
    }

    try {
      telegramUserId = BigInt(normalized);
    } catch {
      return { ok: false as const, error: "telegramUserId is outside the supported range" };
    }

    if (telegramUserId <= BigInt(0) || telegramUserId > MAX_TELEGRAM_USER_ID) {
      return { ok: false as const, error: "telegramUserId is outside the supported range" };
    }
  }

  if (typeof source.telegramEnabled !== "boolean") {
    return { ok: false as const, error: "telegramEnabled must be a boolean" };
  }

  const timezone = String(source.timezone ?? DEFAULT_OPS_TIMEZONE).trim();
  if (!timezone || timezone.length > 64 || !isValidTimeZone(timezone)) {
    return { ok: false as const, error: "timezone must be a valid IANA timezone" };
  }

  if (source.telegramEnabled && telegramUserId === null) {
    return { ok: false as const, error: "telegramUserId is required when Telegram is enabled" };
  }

  return {
    ok: true as const,
    value: {
      telegramUserId,
      telegramEnabled: source.telegramEnabled,
      timezone,
    } satisfies NormalizedOpsMemberProfile,
  };
}

function normalizeAdminUserName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, MAX_ADMIN_USER_NAME_LENGTH);
  return trimmed || null;
}

export function normalizeAdminRoleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return { ok: false as const, error: "roleIds must be an array of strings" };
  }

  const seen = new Set<string>();
  const roleIds: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      return { ok: false as const, error: "roleIds must be an array of strings" };
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const, error: "Invalid request body" };
  }

  const payload = body as Record<string, unknown>;
  const normalized: NormalizedAdminUserPatch = {};
  const updatedFields: string[] = [];

  if ("email" in payload) {
    const normalizedEmail = normalizeAdminEmail(payload.email);
    if (!normalizedEmail.ok) {
      return normalizedEmail;
    }
    normalized.email = normalizedEmail.value;
    updatedFields.push("email");
  }

  if ("name" in payload) {
    if (typeof payload.name !== "string") {
      return { ok: false as const, error: "name must be a string" };
    }
    normalized.name = normalizeAdminUserName(payload.name);
    updatedFields.push("name");
  }

  if ("isActive" in payload) {
    if (typeof payload.isActive !== "boolean") {
      return { ok: false as const, error: "isActive must be a boolean" };
    }
    normalized.isActive = payload.isActive;
    updatedFields.push("isActive");
  }

  if ("roleIds" in payload) {
    const normalizedRoleIds = normalizeAdminRoleIds(payload.roleIds);
    if (!normalizedRoleIds.ok) {
      return normalizedRoleIds;
    }
    normalized.roleIds = normalizedRoleIds.value;
    updatedFields.push("roleIds");
  }

  if ("password" in payload) {
    const normalizedPassword = normalizeAdminPassword(payload.password);
    if (!normalizedPassword.ok) {
      return normalizedPassword;
    }
    normalized.password = normalizedPassword.value;
    updatedFields.push("passwordHash");
  }

  if ("opsProfile" in payload) {
    const normalizedOpsProfile = normalizeOpsMemberProfilePayload(payload.opsProfile);
    if (!normalizedOpsProfile.ok) {
      return normalizedOpsProfile;
    }
    normalized.opsProfile = normalizedOpsProfile.value;
    updatedFields.push("opsProfile");
  }

  if (!updatedFields.length) {
    return { ok: false as const, error: "No valid fields to update" };
  }

  return {
    ok: true as const,
    value: normalized,
    updatedFields,
  };
}

export function determineAdminUserAuditAction(
  previousIsActive: boolean,
  nextIsActive: boolean,
  updatedFields: string[]
) {
  if (updatedFields.includes("isActive") && previousIsActive !== nextIsActive) {
    return nextIsActive ? "admin.user.activate" : "admin.user.deactivate";
  }

  return "admin.user.update";
}

export function serializeAdminUser(user: AdminUserWithRoles): SerializedAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hasPassword: Boolean(user.passwordHash),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles: user.roles.map(({ role }) => ({
      id: role.id,
      key: role.key,
      name: role.name,
    })),
    opsProfile: user.opsProfile
      ? {
          telegramUserId: user.opsProfile.telegramUserId?.toString() ?? null,
          telegramEnabled: user.opsProfile.telegramEnabled,
          timezone: user.opsProfile.timezone,
        }
      : null,
  };
}
