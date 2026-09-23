import "server-only";

import type { Prisma } from "@prisma/client";

import type { SupplementalCatalogNormalization } from "./shopCatalogSupplementalNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
import { persistCanonicalPolicyInTransaction } from "./shopCatalogCanonicalPolicyPersistence.server";

export function persistSupplementalCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  normalization: SupplementalCatalogNormalization;
}) {
  if (input.normalization.compatibilityPolicy) {
    if (input.normalization.compatibilityPolicy.target.productId !== input.normalization.productId ||
      input.normalization.compatibilityPolicy.target.variantId != null) {
      throw new Error(`${input.normalization.source} compatibility target does not match its product record`);
    }
    return persistCanonicalPolicyInTransaction({
      tx: input.tx,
      sourceId: input.sourceId,
      sourceRecordId: input.sourceRecordId,
      evidenceHash: input.payloadHash,
      policy: input.normalization.compatibilityPolicy,
      label: input.normalization.source,
    });
  }
  return persistVehicleCompatibilityInTransaction({
    tx: input.tx,
    sourceId: input.sourceId,
    sourceRecordId: input.sourceRecordId,
    payloadHash: input.payloadHash,
    label: input.normalization.source,
    aliasPrefix: `supplemental-${input.normalization.source}-alias`,
    normalization: {
      scope: input.normalization.scope,
      productId: input.normalization.productId,
      variantId: null,
      recordKey: input.normalization.recordKey,
      mode: "NEEDS_REVIEW",
      engineRelevant: input.normalization.engineRelevant,
      applications: [],
      verification: "NEEDS_REVIEW",
    },
  });
}
