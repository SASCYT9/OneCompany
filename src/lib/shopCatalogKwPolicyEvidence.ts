import { createHash } from "node:crypto";

import {
  buildKwCompatibilityPolicy,
  type KwProductNormalization,
} from "./shopCatalogKwNormalization";
import type { ShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";
import type { ShopifySnapshotProduct } from "./shopifyCatalogSnapshot";

export const KW_POLICY_EVIDENCE_MAPPER_VERSION = "kw-policy-evidence-v1";

export type KwPolicyEvidenceEnvelope = Readonly<{
  mapperVersion: typeof KW_POLICY_EVIDENCE_MAPPER_VERSION;
  evidenceHash: string;
  sourceRecord: Readonly<{
    recordKey: string;
    sourceRevision: string;
    payloadHash: string;
    rawPayload: Readonly<{
      mapperVersion: typeof KW_POLICY_EVIDENCE_MAPPER_VERSION;
      product: ShopifySnapshotProduct;
      normalization: KwProductNormalization;
    }>;
  }>;
  policy: ShopCatalogV2CompatibilityPolicy;
}>;

type JsonRecord = Record<string, unknown>;

function stableJson(value: unknown, arrayItem = false): string | undefined {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "undefined") return arrayItem ? "null" : undefined;
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item, true) ?? "null").join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, child]) => {
        const encoded = stableJson(child);
        return encoded === undefined ? [] : [`${JSON.stringify(key)}:${encoded}`];
      });
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("KW policy evidence must contain JSON-compatible values");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function immutableClone<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

/**
 * Preserves the complete raw Shopify row alongside KW's normalized, correlated
 * policy evidence. This is an offline persistence envelope, not a reader input.
 */
export function buildKwPolicyEvidence(input: {
  product: ShopifySnapshotProduct;
  normalization: KwProductNormalization;
  productId: string;
}): KwPolicyEvidenceEnvelope {
  if (input.product.id !== input.normalization.externalProductId) {
    throw new Error(
      `KW policy evidence product identity mismatch: ${input.product.id} !== ${input.normalization.externalProductId}`
    );
  }

  const material = stableJson({
    mapperVersion: KW_POLICY_EVIDENCE_MAPPER_VERSION,
    product: input.product,
    normalization: input.normalization,
  });
  if (!material) throw new TypeError("KW policy evidence payload is empty");
  const rawPayload = immutableClone(
    JSON.parse(material) as {
      mapperVersion: typeof KW_POLICY_EVIDENCE_MAPPER_VERSION;
      product: ShopifySnapshotProduct;
      normalization: KwProductNormalization;
    }
  );
  const serializedPayload = JSON.stringify(rawPayload);
  const evidenceHash = createHash("sha256").update(serializedPayload).digest("hex");
  const sourceRevision = `${KW_POLICY_EVIDENCE_MAPPER_VERSION}:${evidenceHash}`;

  return deepFreeze({
    mapperVersion: KW_POLICY_EVIDENCE_MAPPER_VERSION,
    evidenceHash,
    sourceRecord: {
      recordKey: input.normalization.externalProductId,
      sourceRevision,
      payloadHash: evidenceHash,
      rawPayload,
    },
    policy: buildKwCompatibilityPolicy(input.productId, rawPayload.normalization),
  });
}
