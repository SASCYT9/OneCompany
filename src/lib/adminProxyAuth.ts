const DEFAULT_SECRET = 'dev-admin-session-secret';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const PUBLIC_ADMIN_API_PATHS = new Set(['/api/admin/auth']);
const PUBLIC_ADMIN_PAGE_PATHS = new Set(['/admin']);
const SERVICE_ADMIN_API_PREFIXES = ['/api/admin/cron/'];

type SessionTokenPayload = {
  sub: string;
  name: string;
  permissions: string[];
  iat: number;
  nonce: string;
};

type AccessInput = {
  pathname: string;
  method?: string;
  cookieToken: string | null;
};

type AccessResult = {
  allowed: boolean;
  reason?: 'UNAUTHORIZED';
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getSecret() {
  const configured = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET is required in production');
  }

  return DEFAULT_SECRET;
}

function isFresh(issuedAtMs: number) {
  return Number.isFinite(issuedAtMs) && Date.now() - issuedAtMs < SESSION_TTL_MS;
}

function decodePayload(encoded: string): SessionTokenPayload | null {
  try {
    const json = base64UrlDecodeToString(encoded);
    const payload = JSON.parse(json) as Partial<SessionTokenPayload>;

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
      permissions: payload.permissions.map((value) => String(value ?? '').trim()).filter(Boolean),
      iat: payload.iat,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

function base64UrlDecodeToString(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return textDecoder.decode(bytes);
  }

  return Buffer.from(padded, 'base64').toString('utf8');
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signPayload(payload: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto is not available');
  }

  const key = await subtle.importKey(
    'raw',
    textEncoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return toHex(await subtle.sign('HMAC', key, textEncoder.encode(payload)));
}

async function hasValidAdminCookie(cookieToken: string | null) {
  if (!cookieToken) {
    return false;
  }

  const parts = cookieToken.split('.');
  if (parts.length === 2) {
    const [encodedPayload, signature] = parts;
    const expectedSignature = await signPayload(encodedPayload);
    if (!timingSafeEqualText(signature, expectedSignature)) {
      return false;
    }

    const payload = decodePayload(encodedPayload);
    return Boolean(payload && isFresh(payload.iat));
  }

  if (parts.length === 3) {
    const [issuedAt, nonce, signature] = parts;
    const expectedSignature = await signPayload(`${issuedAt}.${nonce}`);
    return timingSafeEqualText(signature, expectedSignature) && isFresh(Number(issuedAt));
  }

  return false;
}

export async function shouldAllowAdminApiRequest(input: AccessInput): Promise<AccessResult> {
  if (!input.pathname.startsWith('/api/admin')) {
    return { allowed: true };
  }

  if (PUBLIC_ADMIN_API_PATHS.has(input.pathname)) {
    return { allowed: true };
  }

  if (SERVICE_ADMIN_API_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) {
    return { allowed: true };
  }

  if (await hasValidAdminCookie(input.cookieToken)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'UNAUTHORIZED' };
}

export async function shouldAllowAdminPageRequest(input: AccessInput): Promise<AccessResult> {
  if (!input.pathname.startsWith('/admin')) {
    return { allowed: true };
  }

  if (PUBLIC_ADMIN_PAGE_PATHS.has(input.pathname)) {
    return { allowed: true };
  }

  if (await hasValidAdminCookie(input.cookieToken)) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'UNAUTHORIZED' };
}
