import crypto from 'crypto';

export const ADMIN_SESSION_COOKIE = 'onecompany-admin-session';
const DEFAULT_SECRET = 'dev-admin-session-secret';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export type AdminSession = {
  email: string;
  name: string;
  permissions: string[];
  issuedAt: number;
  nonce: string;
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

type SessionTokenPayload = {
  sub: string;
  name: string;
  permissions: string[];
  iat: number;
  nonce: string;
};

function getSecret(): string {
  const rawSecret = process.env.ADMIN_SESSION_SECRET ?? DEFAULT_SECRET;
  const secret = rawSecret.trim();
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not set');
  }
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function toSession(payload: SessionTokenPayload): AdminSession {
  return {
    email: payload.sub,
    name: payload.name,
    permissions: payload.permissions,
    issuedAt: payload.iat,
    nonce: payload.nonce,
  };
}

function encodePayload(payload: SessionTokenPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string): SessionTokenPayload | null {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as Partial<SessionTokenPayload>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.name !== 'string' ||
      !Array.isArray(payload.permissions) ||
      typeof payload.iat !== 'number' ||
      typeof payload.nonce !== 'string'
    ) {
      return null;
    }

    return {
      sub: payload.sub.trim().toLowerCase(),
      name: payload.name.trim(),
      permissions: payload.permissions
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean),
      iat: payload.iat,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

function isFresh(issuedAtMs: number) {
  return Number.isFinite(issuedAtMs) && Date.now() - issuedAtMs < SESSION_TTL_MS;
}

function verifyLegacySessionToken(token: string): AdminSession | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [issuedAt, nonce, signature] = parts;
  const payload = `${issuedAt}.${nonce}`;
  const expectedSignature = signPayload(payload);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  const issuedAtMs = Number(issuedAt);
  if (!isFresh(issuedAtMs)) {
    return null;
  }

  return {
    email: 'legacy-admin@onecompany.local',
    name: 'Legacy Admin',
    permissions: ['*'],
    issuedAt: issuedAtMs,
    nonce,
  };
}

export function createSessionToken(session: {
  email: string;
  name: string;
  permissions: string[];
}): string {
  const payload: SessionTokenPayload = {
    sub: session.email.trim().toLowerCase(),
    name: session.name.trim() || 'Admin',
    permissions: Array.from(new Set(session.permissions.map((entry) => entry.trim()).filter(Boolean))),
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): AdminSession | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length === 2) {
    const [encodedPayload, signature] = parts;
    const expectedSignature = signPayload(encodedPayload);
    const providedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = decodePayload(encodedPayload);
    if (!payload || !isFresh(payload.iat)) {
      return null;
    }

    return toSession(payload);
  }

  return verifyLegacySessionToken(token);
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
};

export function matchesAdminPermission(grantedPermissions: string[], requiredPermission: string): boolean {
  return grantedPermissions.some((permission) => {
    if (permission === '*' || permission === requiredPermission) {
      return true;
    }

    if (permission.endsWith('.*')) {
      const prefix = permission.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }

    return false;
  });
}

export function getAdminSession(cookieStore: CookieReader): AdminSession | null {
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export function isAdminRequestAuthenticated(cookieStore: CookieReader): boolean {
  return getAdminSession(cookieStore) !== null;
}

export function assertAdminRequest(cookieStore: CookieReader, requiredPermission?: string): AdminSession {
  const session = getAdminSession(cookieStore);
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  if (requiredPermission && !matchesAdminPermission(session.permissions, requiredPermission)) {
    throw new Error('FORBIDDEN');
  }

  return session;
}
