import { createHash } from "node:crypto";

import type { FiFitmentEntry, FiSourceProduct } from "./shopCatalogFiDraft";
import type { ShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";

const MAPPER_VERSION = "fi-policy-evidence-v1";

const VERIFIED_FITMENT_STATUSES = new Set([
  "CSV_CORRELATED",
  "METAFIELD_EXACT_SINGLE",
  "REVIEWED_OVERRIDE",
]);

/**
 * Build FI's durable V2 policy from the product's paired fitment evidence.
 * FI supplies brand/model/body only; every absent dimension is explicitly
 * UNKNOWN so the importer never invents year, engine, fuel, or body-style
 * precision. Incomplete or unrecognised entries remain review policies.
 */
export function buildFiCompatibilityPolicy(
  productId: string,
  fitment: FiFitmentEntry
): ShopCatalogV2CompatibilityPolicy {
  const complete =
    VERIFIED_FITMENT_STATUSES.has(fitment.status) &&
    fitment.applications.length > 0 &&
    fitment.applications.every((application) =>
      Boolean(application.brand.trim() && application.model.trim())
    );
  const verification = complete ? ("VERIFIED" as const) : ("NEEDS_REVIEW" as const);
  const clauses = fitment.applications.map((application, index) => ({
    id: `fi-fitment-${index + 1}`,
    verification,
    sourceRef: `fi:${productId}:${fitment.id}:${index + 1}`,
    constraints: [
      { dimension: "scope" as const, state: "EXACT" as const, values: ["auto"] },
      application.brand.trim()
        ? {
            dimension: "make" as const,
            state: "EXACT" as const,
            values: [application.brand.trim()],
          }
        : { dimension: "make" as const, state: "UNKNOWN" as const },
      application.model.trim()
        ? {
            dimension: "model" as const,
            state: "EXACT" as const,
            values: [application.model.trim()],
          }
        : { dimension: "model" as const, state: "UNKNOWN" as const },
      application.body.trim()
        ? {
            dimension: "chassis" as const,
            state: "EXACT" as const,
            values: [application.body.trim()],
          }
        : { dimension: "chassis" as const, state: "UNKNOWN" as const },
      { dimension: "generation" as const, state: "UNKNOWN" as const },
      { dimension: "year" as const, state: "UNKNOWN" as const },
      { dimension: "engine" as const, state: "UNKNOWN" as const },
      { dimension: "fuel" as const, state: "UNKNOWN" as const },
      { dimension: "bodyStyle" as const, state: "UNKNOWN" as const },
      { dimension: "drivetrain" as const, state: "UNKNOWN" as const },
      { dimension: "transmission" as const, state: "UNKNOWN" as const },
      { dimension: "market" as const, state: "UNKNOWN" as const },
      { dimension: "opfGpf" as const, state: "UNKNOWN" as const },
    ],
  }));
  return {
    version: 2,
    mode: complete ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
    target: { productId },
    requiredDimensions: complete ? ["make", "model"] : [],
    dimensionDefaults: {
      generation: "UNKNOWN",
      chassis: "UNKNOWN",
      year: "UNKNOWN",
      engine: "UNKNOWN",
      fuel: "UNKNOWN",
      bodyStyle: "UNKNOWN",
      drivetrain: "UNKNOWN",
      transmission: "UNKNOWN",
      market: "UNKNOWN",
      opfGpf: "UNKNOWN",
    },
    clauses,
  };
}

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
