import "server-only";
import type { Prisma } from "@prisma/client";
import type { Do88Normalization } from "./shopCatalogDo88Normalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
export function persistDo88CompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: Do88Normalization }) {
  const normalization = input.normalization; return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "do88", aliasPrefix: "do88-alias", normalization: { productId: normalization.productId, variantId: normalization.variantId, recordKey: normalization.recordKey,
      mode: normalization.mode, engineRelevant: normalization.engineRelevant, verification: normalization.verification, applications: normalization.applications.map((application) => ({ ...application, scope: "auto", engineCode: null, fuel: null })) } });
}
