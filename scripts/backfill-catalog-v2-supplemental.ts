import { PrismaClient } from "@prisma/client";

import {
  persistBootmod3SourceRecordPageWithClient,
  persistFiExhaustSupplementalSourceRecordPageWithClient,
  persistGSportSourceRecordPageWithClient,
  persistKwSuspensionsSupplementalSourceRecordPageWithClient,
  persistRevozportSourceRecordPageWithClient,
} from "../src/lib/shopCatalogSupplementalBackfill.server";
import {
  SHOP_CATALOG_SUPPLEMENTAL_SOURCES,
  type ShopCatalogSupplementalSource,
} from "../src/lib/shopCatalogSupplementalNormalization";
import {
  loadSupplementalCatalogDrafts,
  supplementalSourceArgument,
} from "./catalog-v2-supplemental-source";

const safeEnvironments = new Set(["local", "development", "test", "preview", "staging"]);
const persisters = {
  bootmod3: persistBootmod3SourceRecordPageWithClient,
  "fi-exhaust": persistFiExhaustSupplementalSourceRecordPageWithClient,
  "g-sport": persistGSportSourceRecordPageWithClient,
  "kw-suspensions": persistKwSuspensionsSupplementalSourceRecordPageWithClient,
  revozport: persistRevozportSourceRecordPageWithClient,
} as const;

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function assertCommitTarget(source: ShopCatalogSupplementalSource) {
  const environment = option("environment")?.toLowerCase();
  const productionAuthorized =
    environment === "production" &&
    process.env.CATALOG_V2_PRODUCTION_PROJECTION_ACK === "1" &&
    process.env.CATALOG_SUPPLEMENTAL_BACKFILL_PRODUCTION_ACK === "1";
  if (!environment || (!safeEnvironments.has(environment) && !productionAuthorized)) {
    throw new Error(
      "Commit requires an explicit safe --environment or both production acknowledgement variables"
    );
  }
  if (
    !productionAuthorized &&
    [process.env.VERCEL_ENV, process.env.DEPLOY_ENV, process.env.APP_ENV].some(
      (value) => value?.toLowerCase() === "production"
    )
  ) {
    throw new Error("Supplemental backfill commit is disabled in production");
  }
  if (process.env.CATALOG_SUPPLEMENTAL_BACKFILL_ALLOW_WRITE !== "1") {
    throw new Error("Set CATALOG_SUPPLEMENTAL_BACKFILL_ALLOW_WRITE=1 to authorize commit");
  }
  const url = process.env.CATALOG_SUPPLEMENTAL_BACKFILL_DATABASE_URL;
  if (!url) throw new Error("CATALOG_SUPPLEMENTAL_BACKFILL_DATABASE_URL is required for commit");
  if (productionAuthorized) {
    const target = new URL(url);
    if (target.hostname !== "db.prisma.io" || target.pathname !== "/postgres") {
      throw new Error(
        "Production supplemental backfill target must be the approved Prisma database"
      );
    }
  }
  process.stdout.write(`[supplemental-backfill] authorized target for ${source}\n`);
  return url;
}

function pages<T>(values: T[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, index * size + size)
  );
}

async function main() {
  const source = supplementalSourceArgument(option("source"));
  const commit = process.argv.includes("--commit");
  const after = option("after") ?? null;
  const requestedLimit = Number(option("limit") ?? 50);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    throw new TypeError("--limit must be between 1 and 50");
  }
  const allDrafts = await loadSupplementalCatalogDrafts(source);
  const remaining = after
    ? allDrafts.filter((draft) => draft.sourceRecord.recordKey.localeCompare(after) > 0)
    : allDrafts;
  const drafts = process.argv.includes("--all") ? remaining : remaining.slice(0, requestedLimit);
  const summary = {
    mode: commit ? "commit" : "dry-run",
    source,
    sourceKey: SHOP_CATALOG_SUPPLEMENTAL_SOURCES[source].sourceKey,
    totalRecords: allDrafts.length,
    after,
    selected: drafts.length,
    needsReview: drafts.filter((draft) => draft.normalization.verification !== "VERIFIED").length,
    provenanceEntries: drafts.reduce((sum, draft) => sum + draft.provenance.length, 0),
    issueEntries: drafts.reduce((sum, draft) => sum + draft.issues.length, 0),
    nextRecordKey: drafts.at(-1)?.sourceRecord.recordKey ?? null,
    complete: remaining.length <= drafts.length,
  };
  if (!commit || !drafts.length) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const client = new PrismaClient({ datasources: { db: { url: assertCommitTarget(source) } } });
  try {
    let inserted = 0;
    let idempotent = 0;
    let provenanceInserted = 0;
    let issuesInserted = 0;
    let completed = 0;
    for (const page of pages(drafts, 50)) {
      const result = await persisters[source](client, { drafts: page });
      inserted += result.inserted;
      idempotent += result.idempotent;
      provenanceInserted += result.provenanceInserted;
      issuesInserted += result.issuesInserted;
      completed += page.length;
      process.stdout.write(`[supplemental-backfill] ${source} ${completed}/${drafts.length}\n`);
    }
    console.log(
      JSON.stringify(
        { ...summary, persistence: { inserted, idempotent, provenanceInserted, issuesInserted } },
        null,
        2
      )
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
