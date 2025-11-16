import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "onecompany-admin-session";
const DEFAULT_SECRET = "dev-admin-session-secret";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const rawSecret = process.env.ADMIN_SESSION_SECRET ?? DEFAULT_SECRET;
  const secret = rawSecret.trim();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const issuedAt = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${issuedAt}.${nonce}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token?: string | null): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [issuedAt, nonce, signature] = parts;
  const payload = `${issuedAt}.${nonce}`;
  const expectedSignature = signPayload(payload);

  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    return false;
  }

  return Date.now() - issuedAtMs < SESSION_TTL_MS;
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export function isAdminRequestAuthenticated(cookieStore: CookieReader): boolean {
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export function assertAdminRequest(cookieStore: CookieReader) {
  if (!isAdminRequestAuthenticated(cookieStore)) {
    throw new Error("UNAUTHORIZED");
  }
}
