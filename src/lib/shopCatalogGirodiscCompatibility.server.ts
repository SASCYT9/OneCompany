import "server-only";
import type { Prisma } from "@prisma/client";
import type { GirodiscNormalization } from "./shopCatalogGirodiscNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
export function persistGirodiscCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: GirodiscNormalization }) {
  const normalization = input.normalization; return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "GiroDisc", aliasPrefix: "girodisc-alias", normalization: { productId: normalization.productId, variantId: normalization.variantId, recordKey: normalization.recordKey,
      mode: normalization.mode, engineRelevant: false, verification: normalization.verification, applications: normalization.applications.map((application) => ({ ...application, scope: "auto", engineCode: null, fuel: null })) } });
}
