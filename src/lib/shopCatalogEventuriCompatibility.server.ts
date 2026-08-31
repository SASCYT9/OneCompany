import "server-only";

import type { Prisma } from "@prisma/client";

import type { EventuriNormalization } from "./shopCatalogEventuriNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";

export function persistEventuriCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  normalization: EventuriNormalization;
}) {
  return persistVehicleCompatibilityInTransaction({
    tx: input.tx,
    sourceId: input.sourceId,
    sourceRecordId: input.sourceRecordId,
    payloadHash: input.payloadHash,
    normalization: {
      ...input.normalization,
      mode: input.normalization.mode === "PARENT_DEPENDENT" ? "NEEDS_REVIEW" : input.normalization.mode,
    },
    label: "Eventuri",
    aliasPrefix: "eventuri-alias",
  });
}
