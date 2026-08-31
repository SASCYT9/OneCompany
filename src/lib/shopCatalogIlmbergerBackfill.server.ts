import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { IlmbergerNormalization } from "./shopCatalogIlmbergerNormalization";
import { persistIlmbergerCompatibilityInTransaction } from "./shopCatalogIlmbergerCompatibility.server";
import { CATALOG_SOURCE_BACKFILL_PAGE_LIMIT, persistCatalogSourceRecordPageWithClient, type CatalogSourceBackfillPageResult, type CatalogSourceRecordDraft } from "./shopCatalogSourceBackfill.server";
export const ILMBERGER_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export function persistIlmbergerSourceRecordPageWithClient(client: PrismaClient, input: { drafts: readonly CatalogSourceRecordDraft<IlmbergerNormalization>[]; sourceKey?: string; sourceDisplayName?: string; reviewedById?: string }): Promise<CatalogSourceBackfillPageResult> { return persistCatalogSourceRecordPageWithClient(client, input, { label: "Ilmberger", defaultSourceKey: "ilmberger-snapshot-v1", defaultDisplayName: "Ilmberger immutable snapshot", decisionReason: "exact immutable Ilmberger product identity; source has no variants", persistCompatibility: persistIlmbergerCompatibilityInTransaction }); }
