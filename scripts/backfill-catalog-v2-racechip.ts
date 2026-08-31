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
  if (!environment || !safeEnvironments.has(environment)) {
    throw new Error("Commit requires an explicit non-production --environment");
  }
  if ([process.env.VERCEL_ENV, process.env.DEPLOY_ENV, process.env.APP_ENV].some((value) => value?.toLowerCase() === "production")) {
    throw new Error("RaceChip backfill commit is disabled in production");
  }
  if (process.env.CATALOG_RACECHIP_BACKFILL_ALLOW_WRITE !== "1") {
    throw new Error("Set CATALOG_RACECHIP_BACKFILL_ALLOW_WRITE=1 to authorize non-production commit");
  }
  const url = process.env.CATALOG_RACECHIP_BACKFILL_DATABASE_URL;
  if (!url) throw new Error("CATALOG_RACECHIP_BACKFILL_DATABASE_URL is required for commit");
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
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    throw new TypeError("--limit must be between 1 and 50");
  }
  const allDrafts = await loadDrafts();
  const remaining = after
    ? allDrafts.filter((draft) => draft.sourceRecord.recordKey.localeCompare(after) > 0)
    : allDrafts;
  const drafts = remaining.slice(0, requestedLimit);
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
    const result = await persistRaceChipSourceRecordPageWithClient(client, {
      drafts,
      reviewedById: process.env.CATALOG_RACECHIP_BACKFILL_REVIEWED_BY_ID,
    });
    console.log(JSON.stringify({ ...summary, persistence: result }, null, 2));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
