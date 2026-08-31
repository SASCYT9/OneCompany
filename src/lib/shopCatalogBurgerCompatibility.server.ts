import "server-only";
import type { Prisma } from "@prisma/client";
import type { BurgerNormalization } from "./shopCatalogBurgerNormalization";
import { persistVehicleCompatibilityInTransaction } from "./shopCatalogVehicleCompatibilityPersistence.server";
export function persistBurgerCompatibilityInTransaction(input: { tx: Prisma.TransactionClient; sourceId: string; sourceRecordId: string; payloadHash: string; normalization: BurgerNormalization }) { const normalization = input.normalization;
  return persistVehicleCompatibilityInTransaction({ tx: input.tx, sourceId: input.sourceId, sourceRecordId: input.sourceRecordId, payloadHash: input.payloadHash, label: "Burger", aliasPrefix: "burger-alias", normalization: {
    productId: normalization.productId, variantId: normalization.variantId, recordKey: normalization.recordKey, mode: normalization.mode, engineRelevant: normalization.engineRelevant, verification: normalization.verification,
    applications: normalization.applications.map((application) => ({ ...application, scope: "auto", fuel: null })) } }); }
