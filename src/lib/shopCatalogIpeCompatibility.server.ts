import "server-only";
import type { Prisma } from "@prisma/client";
import type { IpeNormalization } from "./shopCatalogIpeNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
export function persistIpeCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: IpeNormalization }) {
  const normalization = input.normalization; return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "iPE", aliasPrefix: "ipe-alias", normalization: { productId: normalization.productId, variantId: normalization.variantId, recordKey: normalization.recordKey,
      mode: normalization.mode, engineRelevant: normalization.engineRelevant, opfGpfRelevant: normalization.opfGpfRelevant, verification: normalization.verification,
      applications: normalization.applications.map((application) => ({ ...application, scope: "auto", engineCode: null, fuel: null })) } });
}
