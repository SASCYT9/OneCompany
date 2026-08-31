import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { persistEventuriSourceRecordPageWithClient } from "../src/lib/shopCatalogEventuriBackfill.server";
import { buildEventuriSourceRecordDraft, type EventuriSnapshotProduct } from "../src/lib/shopCatalogEventuriNormalization";

const safeEnvironments = new Set(["local", "development", "test", "preview", "staging"]);
function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim();
}
function assertCommitTarget() {
  const environment = option("environment")?.toLowerCase();
  if (!environment || !safeEnvironments.has(environment)) throw new Error("Commit requires an explicit non-production --environment");
  if ([process.env.VERCEL_ENV, process.env.DEPLOY_ENV, process.env.APP_ENV].some((value) => value?.toLowerCase() === "production")) {
    throw new Error("Eventuri backfill commit is disabled in production");
  }
  if (process.env.CATALOG_EVENTURI_BACKFILL_ALLOW_WRITE !== "1") throw new Error("Set CATALOG_EVENTURI_BACKFILL_ALLOW_WRITE=1 to authorize non-production commit");
  const url = process.env.CATALOG_EVENTURI_BACKFILL_DATABASE_URL;
  if (!url) throw new Error("CATALOG_EVENTURI_BACKFILL_DATABASE_URL is required for commit");
  return url;
}
async function loadDrafts() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { stores?: Record<string, { file?: string; count?: number }> };
  const descriptor = manifest.stores?.generic;
  if (!descriptor?.file || !descriptor.count) throw new Error("Generic fallback shard is missing");
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (!descriptor.file.includes(`.${hash}.json`)) throw new Error("Generic shard hash mismatch");
  const allProducts = JSON.parse(raw) as EventuriSnapshotProduct[];
  if (allProducts.length !== descriptor.count) throw new Error("Generic shard count mismatch");
  return allProducts
    .filter((product) => product.brand?.trim().toLowerCase() === "eventuri")
    .map((product) => buildEventuriSourceRecordDraft({ product, sourceRevision: hash }))
    .sort((left, right) => left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey));
}
async function main() {
  const commit = process.argv.includes("--commit");
  const after = option("after") ?? null;
  const requestedLimit = Number(option("limit") ?? 50);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) throw new TypeError("--limit must be between 1 and 50");
  const allDrafts = await loadDrafts();
  const remaining = after ? allDrafts.filter((draft) => draft.sourceRecord.recordKey.localeCompare(after) > 0) : allDrafts;
  const drafts = remaining.slice(0, requestedLimit);
  const summary = {
    mode: commit ? "commit" : "dry-run",
    totalRecords: allDrafts.length,
    after,
    selected: drafts.length,
    verified: drafts.filter((draft) => draft.normalization.verification === "VERIFIED").length,
    needsReview: drafts.filter((draft) => draft.normalization.verification === "NEEDS_REVIEW").length,
    applications: drafts.reduce((sum, draft) => sum + draft.normalization.applications.length, 0),
    provenanceEntries: drafts.reduce((sum, draft) => sum + draft.provenance.length, 0),
    issueEntries: drafts.reduce((sum, draft) => sum + draft.issues.length, 0),
    nextRecordKey: drafts.at(-1)?.sourceRecord.recordKey ?? null,
    complete: remaining.length <= drafts.length,
  };
  if (!commit || drafts.length === 0) return void console.log(JSON.stringify(summary, null, 2));
  const client = new PrismaClient({ datasources: { db: { url: assertCommitTarget() } } });
  try {
    const result = await persistEventuriSourceRecordPageWithClient(client, {
      drafts,
      reviewedById: process.env.CATALOG_EVENTURI_BACKFILL_REVIEWED_BY_ID,
    });
    console.log(JSON.stringify({ ...summary, persistence: result }, null, 2));
  } finally {
    await client.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
