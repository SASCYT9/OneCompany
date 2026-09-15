import "server-only";

import type { Prisma } from "@prisma/client";

import type { SupplementalCatalogNormalization } from "./shopCatalogSupplementalNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";

export function persistSupplementalCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  normalization: SupplementalCatalogNormalization;
}) {
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
