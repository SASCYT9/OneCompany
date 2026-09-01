import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { persistRaceChipSourceRecordPageWithClient } from "../src/lib/shopCatalogRaceChipBackfill.server";
import {
  buildRaceChipSourceRecordDraft,
  type RaceChipSnapshotProduct,
} from "../src/lib/shopCatalogRaceChipNormalization";

const safeEnvironments = new Set(["local", "development", "test", "preview", "staging"]);

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim();
}

function assertCommitTarget() {
  const environment = option("environment")?.toLowerCase();
  const productionAuthorized =
    environment === "production" && process.env.CATALOG_V2_PRODUCTION_PROJECTION_ACK === "1";
  if (!environment || (!safeEnvironments.has(environment) && !productionAuthorized)) {
    throw new Error("Commit requires an explicit safe --environment or the production acknowledgement");
  }
  if (!productionAuthorized && [process.env.VERCEL_ENV, process.env.DEPLOY_ENV, process.env.APP_ENV].some((value) => value?.toLowerCase() === "production")) {
    throw new Error("RaceChip backfill commit is disabled in production");
  }
  if (process.env.CATALOG_RACECHIP_BACKFILL_ALLOW_WRITE !== "1") {
    throw new Error("Set CATALOG_RACECHIP_BACKFILL_ALLOW_WRITE=1 to authorize non-production commit");
  }
  const url = process.env.CATALOG_RACECHIP_BACKFILL_DATABASE_URL;
  if (!url) throw new Error("CATALOG_RACECHIP_BACKFILL_DATABASE_URL is required for commit");
  if (productionAuthorized) {
    const target = new URL(url);
    if (target.hostname !== "db.prisma.io" || target.pathname !== "/postgres") {
      throw new Error("Production RaceChip backfill target must be the approved Prisma database");
    }
  }
  return url;
}

async function loadDrafts() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.racechip;
  if (!descriptor?.file || !descriptor.count) throw new Error("RaceChip fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("RaceChip shard hash mismatch");
  const products = JSON.parse(raw) as RaceChipSnapshotProduct[];
  if (products.length !== descriptor.count) throw new Error("RaceChip shard count mismatch");
  return products
    .map((product) => buildRaceChipSourceRecordDraft({ product, sourceRevision: hash }))
    .sort((left, right) => left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey));
}

async function main() {
  const commit = process.argv.includes("--commit");
  const after = option("after") ?? null;
  const requestedLimit = Number(option("limit") ?? 50);
  const concurrency = Number(option("concurrency") ?? 1);
  const pageSize = Number(option("page-size") ?? 50);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    throw new TypeError("--limit must be between 1 and 50");
  }
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 12) {
    throw new TypeError("--concurrency must be between 1 and 12");
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new TypeError("--page-size must be between 1 and 50");
  }
  const allDrafts = await loadDrafts();
  const remaining = after
    ? allDrafts.filter((draft) => draft.sourceRecord.recordKey.localeCompare(after) > 0)
    : allDrafts;
  const drafts = process.argv.includes("--all") ? remaining : remaining.slice(0, requestedLimit);
  const summary = {
    mode: commit ? "commit" : "dry-run",
    totalRecords: allDrafts.length,
    after,
    selected: drafts.length,
    verified: drafts.filter((draft) => draft.normalization.verification === "VERIFIED").length,
    needsReview: drafts.filter((draft) => draft.normalization.verification === "NEEDS_REVIEW").length,
    provenanceEntries: drafts.reduce((sum, draft) => sum + draft.provenance.length, 0),
    issueEntries: drafts.reduce((sum, draft) => sum + draft.issues.length, 0),
    nextRecordKey: drafts.at(-1)?.sourceRecord.recordKey ?? null,
    complete: remaining.length <= drafts.length,
  };
  if (!commit || drafts.length === 0) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const client = new PrismaClient({ datasources: { db: { url: assertCommitTarget() } } });
  try {
    let inserted = 0;
    let idempotent = 0;
    let provenanceInserted = 0;
    let issuesInserted = 0;
    let completed = 0;
    let nextPage = 0;
    const pages = Array.from({ length: Math.ceil(drafts.length / pageSize) }, (_, index) =>
      drafts.slice(index * pageSize, index * pageSize + pageSize)
    );
    const worker = async () => {
      while (true) {
        const pageIndex = nextPage++;
        const page = pages[pageIndex];
        if (!page) return;
      const result = await persistRaceChipSourceRecordPageWithClient(client, {
        drafts: page,
        reviewedById: process.env.CATALOG_RACECHIP_BACKFILL_REVIEWED_BY_ID,
      });
        inserted += result.inserted;
        idempotent += result.idempotent;
        provenanceInserted += result.provenanceInserted;
        issuesInserted += result.issuesInserted;
        completed += page.length;
        process.stdout.write(`[racechip-backfill] ${completed}/${drafts.length}\n`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, pages.length) }, () => worker()));
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
