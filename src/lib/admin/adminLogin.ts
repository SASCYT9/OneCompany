import { OWNER_ROLE_KEY, SUPERADMIN_ROLE_KEY } from "@/lib/admin/adminPermissions";
import { verifyPassword } from "@/lib/hashPassword";

export type AdminLoginUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  passwordHash: string | null;
  roles: Array<{
    role: {
      key: string;
      permissions: string[];
    };
  }>;
};

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  name: string;
  permissions: string[];
};

export type AdminLoginRepository = {
  findByEmail: (email: string) => Promise<AdminLoginUser | null>;
  markLogin: (id: string, loggedInAt: Date) => Promise<void>;
  bootstrapIfEmpty: () => Promise<AuthenticatedAdmin | null>;
};

export type AdminLoginConfig = {
  fallbackEmail: string;
  fallbackPassword: string | null;
  bootstrapEnabled: boolean;
};

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toAuthenticatedAdmin(user: AdminLoginUser): AuthenticatedAdmin {
  const roleKeys = uniqueStrings(user.roles.map(({ role }) => role.key));
  const permissions = uniqueStrings(user.roles.flatMap(({ role }) => role.permissions));
  const isOwner =
    permissions.includes("*") ||
    roleKeys.includes(OWNER_ROLE_KEY) ||
    roleKeys.includes(SUPERADMIN_ROLE_KEY);

  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    name: user.name?.trim() || "Admin",
    permissions: isOwner ? ["*"] : permissions,
  };
}

/**
 * Database credentials are independent from the optional bootstrap password.
 * The fallback is accepted only while creating the first admin in an empty
 * database. Once an identity exists, its passwordHash is the only password
 * credential that can authenticate it.
 */
export async function authenticateAdminCredentials(
  input: { email: unknown; password: unknown },
  config: AdminLoginConfig,
  repository: AdminLoginRepository
): Promise<AuthenticatedAdmin | null> {
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(input.password ?? "");
  if (!email || !password) {
    return null;
  }

  const user = await repository.findByEmail(email);

  if (user?.isActive && user.passwordHash && verifyPassword(password, user.passwordHash)) {
    await repository.markLogin(user.id, new Date());
    return toAuthenticatedAdmin(user);
  }

  // Never let the environment bootstrap secret bypass an existing identity's
  // password hash, activation state, or current role assignment.
  if (user) {
    return null;
  }

  const fallbackMatches =
    email === config.fallbackEmail.trim().toLowerCase() &&
    Boolean(config.fallbackPassword) &&
    password === config.fallbackPassword;
  if (!fallbackMatches) {
    return null;
  }

  if (!config.bootstrapEnabled) {
    return null;
  }

  return repository.bootstrapIfEmpty();
}
