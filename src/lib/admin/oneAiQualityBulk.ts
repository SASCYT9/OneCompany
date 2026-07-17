import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  parseOneAiQualityMutation,
  type OneAiQualityMutationInput,
} from "@/lib/admin/oneAiQualityMutation";

export const ONE_AI_QUALITY_BULK_MAX_PRODUCTS = 25;
export const ONE_AI_QUALITY_BULK_PREVIEW_TTL_MS = 5 * 60_000;
export const ONE_AI_QUALITY_BULK_TOKEN_PREFIX = "oc-ai-bulk-v1";

const BULK_ACTIONS = new Set([
  "verify_and_reindex",
  "mark_universal",
  "block_strict",
  "needs_source",
]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type OneAiQualityBulkMutation = Omit<
  OneAiQualityMutationInput,
  "expectedRevision" | "targetRevisionId" | "targetRevision"
>;

export type OneAiQualityBulkPreviewInput = {
  productIds: string[];
  mutation: OneAiQualityBulkMutation;
};

export type OneAiQualityBulkHomogeneousKey = {
  scope: "auto" | "moto";
  categoryGroup: string | null;
  productKind: string | null;
};

export type OneAiQualityBulkPreviewTokenPayload = {
  version: 1;
  purpose: "one-ai-quality-bulk";
  issuedAt: number;
  expiresAt: number;
  actorHash: string;
  homogeneous: OneAiQualityBulkHomogeneousKey;
  products: Array<{ productId: string; expectedRevision: number }>;
  mutation: OneAiQualityBulkMutation;
};

export type OneAiQualityBulkTokenVerification =
  | { ok: true; payload: OneAiQualityBulkPreviewTokenPayload }
  | {
      ok: false;
      reason:
        | "weak-secret"
        | "malformed-token"
        | "invalid-signature"
        | "invalid-payload"
        | "expired"
        | "actor-mismatch";
    };

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanProductIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  const productIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const productId = entry.trim();
    if (!ID_PATTERN.test(productId)) return null;
    if (seen.has(productId)) continue;
    seen.add(productId);
    productIds.push(productId);
  }
  if (productIds.length < 2 || productIds.length > ONE_AI_QUALITY_BULK_MAX_PRODUCTS) {
    return null;
  }
  return productIds;
}

function parseMutationTemplate(value: RecordValue) {
  const parsed = parseOneAiQualityMutation({
    ...value,
    expectedRevision: 1,
  });
  if (!parsed.ok) return parsed;
  if (!BULK_ACTIONS.has(parsed.value.action)) {
    return { ok: false as const, error: `${parsed.value.action} is not allowed in bulk` };
  }
  if (
    parsed.value.application &&
    (parsed.value.application.applicationId !== null || parsed.value.application.variantId !== null)
  ) {
    return {
      ok: false as const,
      error: "Bulk applications cannot reference a product-specific application or variant",
    };
  }
  return {
    ok: true as const,
    value: {
      action: parsed.value.action,
      reason: parsed.value.reason,
      application: parsed.value.application,
      evidence: parsed.value.evidence,
    } satisfies OneAiQualityBulkMutation,
  };
}

export function parseOneAiQualityBulkPreviewInput(
  value: unknown
): { ok: true; value: OneAiQualityBulkPreviewInput } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid request body" };
  const productIds = cleanProductIds(value.productIds);
  if (!productIds) {
    return {
      ok: false,
      error: `productIds must contain 2-${ONE_AI_QUALITY_BULK_MAX_PRODUCTS} unique valid IDs`,
    };
  }
  const mutation = parseMutationTemplate(value);
  if (!mutation.ok) return mutation;
  return { ok: true, value: { productIds, mutation: mutation.value } };
}

export function parseOneAiQualityBulkApplyInput(
  value: unknown
):
  | { ok: true; value: { previewToken: string; idempotencyKey: string } }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid request body" };
  if (typeof value.previewToken !== "string" || value.previewToken.length > 64 * 1024) {
    return { ok: false, error: "previewToken is invalid" };
  }
  const idempotencyKey =
    typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return {
      ok: false,
      error: "idempotencyKey must be 8-128 URL-safe characters",
    };
  }
  return {
    ok: true,
    value: { previewToken: value.previewToken, idempotencyKey },
  };
}

export function hashOneAiQualityBulkActor(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export function hashOneAiQualityBulkToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getOneAiQualityBulkSigningSecret() {
  const configured = (
    process.env.ONE_AI_QUALITY_BULK_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    ""
  ).trim();
  if (Buffer.byteLength(configured, "utf8") >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ONE_AI_QUALITY_BULK_SECRET or a 32-byte ADMIN_SESSION_SECRET is required in production"
    );
  }
  return "development-one-ai-quality-bulk-secret-32-bytes";
}

function hasStrongSecret(secret: string) {
  return Buffer.byteLength(secret, "utf8") >= 32;
}

function signature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${ONE_AI_QUALITY_BULK_TOKEN_PREFIX}.${encodedPayload}`, "utf8")
    .digest("base64url");
}

function validateHomogeneous(value: unknown): OneAiQualityBulkHomogeneousKey | null {
  if (!isRecord(value)) return null;
  const scope = value.scope === "auto" || value.scope === "moto" ? value.scope : null;
  const categoryGroup =
    value.categoryGroup === null ||
    (typeof value.categoryGroup === "string" && value.categoryGroup.length <= 80)
      ? value.categoryGroup
      : undefined;
  const productKind =
    value.productKind === null ||
    (typeof value.productKind === "string" && value.productKind.length <= 80)
      ? value.productKind
      : undefined;
  if (!scope || categoryGroup === undefined || productKind === undefined) return null;
  return { scope, categoryGroup, productKind };
}

function validateTokenPayload(value: unknown): OneAiQualityBulkPreviewTokenPayload | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    value.purpose !== "one-ai-quality-bulk" ||
    typeof value.issuedAt !== "number" ||
    !Number.isSafeInteger(value.issuedAt) ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= value.issuedAt ||
    value.expiresAt - value.issuedAt > ONE_AI_QUALITY_BULK_PREVIEW_TTL_MS ||
    typeof value.actorHash !== "string" ||
    !SHA256_PATTERN.test(value.actorHash)
  ) {
    return null;
  }
  const homogeneous = validateHomogeneous(value.homogeneous);
  if (!homogeneous || !Array.isArray(value.products)) return null;
  const productIds = cleanProductIds(
    value.products.map((entry) => (isRecord(entry) ? entry.productId : null))
  );
  if (!productIds || productIds.length !== value.products.length) return null;
  const products = value.products.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.productId !== "string" ||
      !ID_PATTERN.test(entry.productId) ||
      typeof entry.expectedRevision !== "number" ||
      !Number.isInteger(entry.expectedRevision) ||
      entry.expectedRevision < 1
    ) {
      return null;
    }
    return {
      productId: entry.productId,
      expectedRevision: entry.expectedRevision,
    };
  });
  if (products.some((entry) => entry === null)) return null;
  if (!isRecord(value.mutation)) return null;
  const mutation = parseMutationTemplate(value.mutation);
  if (!mutation.ok) return null;
  return {
    version: 1,
    purpose: "one-ai-quality-bulk",
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    actorHash: value.actorHash,
    homogeneous,
    products: products as Array<{ productId: string; expectedRevision: number }>,
    mutation: mutation.value,
  };
}

export function createOneAiQualityBulkPreviewToken(
  payload: OneAiQualityBulkPreviewTokenPayload,
  secret: string
) {
  if (!hasStrongSecret(secret)) {
    throw new Error("One AI bulk preview signing secret must be at least 32 bytes");
  }
  const validated = validateTokenPayload(payload);
  if (!validated) throw new Error("One AI bulk preview token payload is invalid");
  const encodedPayload = Buffer.from(JSON.stringify(validated), "utf8").toString("base64url");
  return `${ONE_AI_QUALITY_BULK_TOKEN_PREFIX}.${encodedPayload}.${signature(
    encodedPayload,
    secret
  )}`;
}

export function verifyOneAiQualityBulkPreviewToken(
  token: string,
  secret: string,
  actorHash: string,
  now = Date.now()
): OneAiQualityBulkTokenVerification {
  if (!hasStrongSecret(secret)) return { ok: false, reason: "weak-secret" };
  const prefix = `${ONE_AI_QUALITY_BULK_TOKEN_PREFIX}.`;
  if (!token.startsWith(prefix)) return { ok: false, reason: "malformed-token" };
  const body = token.slice(prefix.length);
  const separator = body.lastIndexOf(".");
  if (separator <= 0 || separator === body.length - 1) {
    return { ok: false, reason: "malformed-token" };
  }
  const encodedPayload = body.slice(0, separator);
  const suppliedSignature = body.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]+$/u.test(suppliedSignature)) {
    return { ok: false, reason: "malformed-token" };
  }
  const expectedSignature = signature(encodedPayload, secret);
  const suppliedBytes = Buffer.from(suppliedSignature, "utf8");
  const expectedBytes = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return { ok: false, reason: "invalid-signature" };
  }
  try {
    const payload = validateTokenPayload(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown
    );
    if (!payload) return { ok: false, reason: "invalid-payload" };
    if (payload.actorHash !== actorHash) return { ok: false, reason: "actor-mismatch" };
    if (payload.expiresAt <= now || payload.issuedAt > now + 30_000) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "invalid-payload" };
  }
}
