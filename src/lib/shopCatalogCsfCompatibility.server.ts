import "server-only";
import type { Prisma } from "@prisma/client";
import type { CsfNormalization } from "./shopCatalogCsfNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
export function persistCsfCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: CsfNormalization }) {
  const normalization = input.normalization; return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash,
    label: "CSF", aliasPrefix: "csf-alias", normalization: { productId: normalization.productId, variantId: normalization.variantId, recordKey: normalization.recordKey,
      mode: normalization.mode, engineRelevant: normalization.engineRelevant, transmissionRelevant: normalization.transmissionRelevant, verification: normalization.verification,
      applications: normalization.applications.map((application) => ({ ...application, scope: "auto", engineCode: null, fuel: null })) } });
}
