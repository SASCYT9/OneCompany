/**
 * Admin → customer impersonation. Lets a logged-in admin browse the
 * storefront/cabinet as a specific customer for support / debugging.
 *
 * Implementation: signed HMAC cookie `oc-shop-impersonation` carrying
 * { adminEmail, adminName, customerId, iat, exp }. The cookie does NOT replace
 * the customer's NextAuth session — it overlays it. `getCurrentShopCustomerSession`
 * is wrapped to prefer the impersonation cookie when present, so all
 * existing call-sites get the impersonated customer transparently.
 *
 * No password access. Read-mostly: writes that mutate the customer's identity
 * (password, email) MUST refuse when an impersonation cookie is active.
 */

import crypto from 'crypto';

export const SHOP_IMPERSONATION_COOKIE = 'oc-shop-impersonation';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export type ImpersonationPayload = {
  adminEmail: string;
  adminName: string;
  customerId: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const configured = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET is required in production');
  }
  return 'dev-admin-session-secret';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createImpersonationToken(input: {
  adminEmail: string;
  adminName: string;
  customerId: string;
}): { token: string; expiresAt: Date } {
  const now = Date.now();
  const payload: ImpersonationPayload = {
    adminEmail: input.adminEmail.trim().toLowerCase(),
    adminName: input.adminName.trim() || input.adminEmail,
    customerId: input.customerId,
    iat: now,
    exp: now + TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(encoded);
  return {
    token: `${encoded}.${signature}`,
    expiresAt: new Date(payload.exp),
  };
}

export function verifyImpersonationToken(token: string | null | undefined): ImpersonationPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expected = sign(encoded);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: Partial<ImpersonationPayload>;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof payload.adminEmail !== 'string' ||
    typeof payload.adminName !== 'string' ||
    typeof payload.customerId !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  if (Date.now() >= payload.exp) return null;

  return {
    adminEmail: payload.adminEmail,
    adminName: payload.adminName,
    customerId: payload.customerId,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export const SHOP_IMPERSONATION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: Math.floor(TTL_MS / 1000),
};
