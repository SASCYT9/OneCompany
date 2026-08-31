import "server-only";
import type { Prisma } from "@prisma/client";
import type { OhlinsNormalization } from "./shopCatalogOhlinsNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";

export function persistOhlinsCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: OhlinsNormalization }) {
  return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "Ohlins", aliasPrefix: "ohlins-alias", normalization: { productId: input.normalization.productId, variantId: input.normalization.variantId,
      recordKey: input.normalization.recordKey, mode: input.normalization.mode, engineRelevant: false, verification: input.normalization.verification,
      applications: input.normalization.applications.map((application) => ({ ...application, yearFrom: null, yearTo: null, engineCode: null, fuel: null })) } });
}
