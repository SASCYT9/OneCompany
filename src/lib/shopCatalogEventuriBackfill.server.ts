import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { EventuriNormalization } from "./shopCatalogEventuriNormalization";
import { persistEventuriCompatibilityInTransaction } from "./shopCatalogEventuriCompatibility.server";
import {
  CATALOG_SOURCE_BACKFILL_PAGE_LIMIT,
  persistCatalogSourceRecordPageWithClient,
  type CatalogSourceBackfillPageResult,
  type CatalogSourceRecordDraft,
} from "./shopCatalogSourceBackfill.server";

export const EVENTURI_BACKFILL_PAGE_LIMIT = CATALOG_SOURCE_BACKFILL_PAGE_LIMIT;

export function persistEventuriSourceRecordPageWithClient(
  client: PrismaClient,
  input: {
    drafts: readonly CatalogSourceRecordDraft<EventuriNormalization>[];
    sourceKey?: string;
    sourceDisplayName?: string;
    reviewedById?: string;
  }
): Promise<CatalogSourceBackfillPageResult> {
  return persistCatalogSourceRecordPageWithClient(client, input, {
    label: "Eventuri",
    defaultSourceKey: "eventuri-snapshot-v1",
    defaultDisplayName: "Eventuri immutable snapshot subset",
    decisionReason: "exact immutable Eventuri product and default-variant identity",
    persistCompatibility: persistEventuriCompatibilityInTransaction,
  });
}
