import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { OpsError } from "@/lib/operations/errors";

export const OPS_CSRF_COOKIE = "onecompany-ops-csrf";
export const OPS_CSRF_HEADER = "x-ops-csrf-token";
export const OPS_IDEMPOTENCY_HEADER = "idempotency-key";
export const OPS_ENTITY_VERSION_HEADER = "x-ops-entity-version";

export function createOpsCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function firstForwardedValue(value: string | null | undefined) {
  return (
    String(value ?? "")
      .split(",", 1)[0]
      ?.trim() ?? ""
  );
}

function normalizeHttpOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originFromHost(protocol: string, host: string | null | undefined) {
  const normalizedProtocol = firstForwardedValue(protocol).replace(/:$/, "").toLowerCase();
  const normalizedHost = firstForwardedValue(host);
  if (
    !["http", "https"].includes(normalizedProtocol) ||
    !normalizedHost ||
    /[\s/@\\?#]/.test(normalizedHost)
  ) {
    return null;
  }
  return normalizeHttpOrigin(`${normalizedProtocol}://${normalizedHost}`);
}

export function resolveOpsAllowedMutationOrigins(input: {
  requestOrigin: string;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}) {
  const allowed = new Set<string>();
  const requestOrigin = normalizeHttpOrigin(input.requestOrigin);
  if (requestOrigin) allowed.add(requestOrigin);

  const fallbackProtocol = requestOrigin ? new URL(requestOrigin).protocol : "https:";
  const publicProtocol = firstForwardedValue(input.forwardedProto) || fallbackProtocol;
  const hostOrigin = originFromHost(publicProtocol, input.host);
  const forwardedOrigin = originFromHost(publicProtocol, input.forwardedHost);
  if (hostOrigin) allowed.add(hostOrigin);
  if (forwardedOrigin) allowed.add(forwardedOrigin);

  return allowed;
}

export function assertOpsMutationBoundary(request: NextRequest) {
  const origin = normalizeHttpOrigin(request.headers.get("origin"));
  const allowedOrigins = resolveOpsAllowedMutationOrigins({
    requestOrigin: request.nextUrl.origin,
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  if (origin && !allowedOrigins.has(origin)) {
    throw new OpsError("INVALID_ORIGIN", 403, "Mutation origin is not allowed");
  }

  const cookieToken = request.cookies.get(OPS_CSRF_COOKIE)?.value ?? "";
  const headerToken = request.headers.get(OPS_CSRF_HEADER)?.trim() ?? "";
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (
    !cookieToken ||
    !headerToken ||
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    throw new OpsError("CSRF_TOKEN_INVALID", 403, "A valid operations CSRF token is required");
  }
}

export function requireIdempotencyKey(request: NextRequest) {
  const key = request.headers.get(OPS_IDEMPOTENCY_HEADER)?.trim() ?? "";
  if (key.length < 8 || key.length > 200) {
    throw new OpsError(
      "IDEMPOTENCY_KEY_REQUIRED",
      400,
      "Idempotency-Key must be between 8 and 200 characters"
    );
  }
  return key;
}

export function requireIfMatch(request: NextRequest) {
  // Vercel may evaluate the standard If-Match header before an App Router
  // mutation reaches its Route Handler and return a platform-level 412.
  // Keep If-Match compatibility for API callers, while the admin client uses
  // this application-owned header for the same optimistic-lock contract.
  const raw =
    request.headers.get(OPS_ENTITY_VERSION_HEADER)?.trim() ??
    request.headers.get("if-match")?.trim() ??
    "";
  const match = raw.match(/^(?:W\/)?"?(\d+)"?$/);
  const version = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new OpsError("IF_MATCH_REQUIRED", 428, "If-Match must contain the entity version");
  }
  return version;
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)])
    );
  }
  return value;
}

export function hashOpsRequest(payload: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableJsonValue(payload)))
    .digest("hex");
}

export function toStoredJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function withEntityHeaders(response: Response, version?: number, replayed = false) {
  if (version) {
    response.headers.set("ETag", `"${version}"`);
  }
  if (replayed) {
    response.headers.set("Idempotency-Replayed", "true");
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
