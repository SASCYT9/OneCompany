import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { RaceChipSourceRecordDraft } from "./shopCatalogRaceChipNormalization";
import { persistRaceChipCompatibilityInTransaction } from "./shopCatalogRaceChipCompatibility.server";
import {
  CATALOG_SOURCE_BACKFILL_PAGE_LIMIT,
  persistCatalogSourceRecordPageWithClient,
  type CatalogSourceBackfillPageResult,
} from "./shopCatalogSourceBackfill.server";

export const RACECHIP_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;
export type RaceChipBackfillPageResult = CatalogSourceBackfillPageResult;

export async function persistRaceChipSourceRecordPageWithClient(
  client: PrismaClient,
  input: {
    drafts: readonly RaceChipSourceRecordDraft[];
    sourceKey?: string;
    sourceDisplayName?: string;
    reviewedById?: string;
  }
): Promise<RaceChipBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, {
    label: "RaceChip",
    defaultSourceKey: "racechip-snapshot-v1",
    defaultDisplayName: "RaceChip immutable snapshot",
    decisionReason: "exact immutable RaceChip product and default-variant identity",
    persistCompatibility: persistRaceChipCompatibilityInTransaction,
  });
}
