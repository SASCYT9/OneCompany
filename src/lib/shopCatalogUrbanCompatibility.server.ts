import "server-only";
import type { Prisma } from "@prisma/client";
import type { UrbanNormalization } from "./shopCatalogUrbanNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";

export function persistUrbanCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: UrbanNormalization }) {
  return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "Urban", aliasPrefix: "urban-alias", normalization: {
      productId: input.normalization.productId, variantId: input.normalization.variantId, recordKey: input.normalization.recordKey,
      mode: input.normalization.verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
      engineRelevant: input.normalization.engineRelevant, verification: input.normalization.verification,
      applications: input.normalization.applications.map((application) => ({ ...application, yearFrom: null, yearTo: null, engineCode: null, fuel: null })),
    } });
}
