import { createHash } from "node:crypto";

import type { FiFitmentEntry, FiSourceProduct } from "./shopCatalogFiDraft";

const MAPPER_VERSION = "fi-policy-evidence-v1";

export function buildFiPolicyEvidence(input: {
  product: FiSourceProduct;
  fitment: FiFitmentEntry;
}) {
  const productId = String(input.product.id);
  if (input.fitment.id !== productId && input.fitment.id !== `gid://shopify/Product/${productId}`) {
    throw new TypeError("FI fitment evidence product identity mismatch");
  }
  if (input.fitment.handle !== input.product.handle) {
    throw new TypeError("FI fitment evidence handle mismatch");
  }

  const rawPayload = JSON.parse(
    JSON.stringify({
      mapperVersion: MAPPER_VERSION,
      product: input.product,
      fitment: input.fitment,
    })
  ) as { mapperVersion: typeof MAPPER_VERSION; product: FiSourceProduct; fitment: FiFitmentEntry };
  const payloadHash = createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex");

  return Object.freeze({
    sourceRecord: Object.freeze({
      recordKey: String(input.product.id),
      sourceRevision: `${MAPPER_VERSION}:${payloadHash}`,
      payloadHash,
      rawPayload,
    }),
  });
}
