import "server-only";
import type { Prisma } from "@prisma/client";
import type { AkrapovicNormalization } from "./shopCatalogAkrapovicNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";

export function persistAkrapovicCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: AkrapovicNormalization }) {
  const normalization = input.normalization;
  return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "Akrapovic", aliasPrefix: "akrapovic-alias", normalization: { scope: normalization.scope, productId: normalization.productId,
      variantId: normalization.variantId, recordKey: normalization.recordKey, mode: normalization.mode, engineRelevant: normalization.engineRelevant,
      verification: normalization.verification, applications: normalization.applications.map((application) => ({ ...application, engineCode: null, fuel: null })) } });
}
