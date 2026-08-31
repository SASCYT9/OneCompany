import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { readShopCatalogSourceCoveragePage } from "../src/lib/shopCatalogSourceCoverageReport.server";

const safeEnvironments = new Set(["local", "development", "test", "preview", "staging"]);
const artifactRoot = resolve("artifacts", "catalog-v2-source-coverage");

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim();
}

function assertSafeRead() {
  const environment = argument("environment")?.toLowerCase();
  if (!environment || !safeEnvironments.has(environment)) {
    throw new Error("Use an explicit non-production --environment");
  }
  if ([process.env.VERCEL_ENV, process.env.DEPLOY_ENV, process.env.APP_ENV].some((value) => value?.toLowerCase() === "production")) {
    throw new Error("Source coverage audit is disabled in production");
  }
  if (process.env.CATALOG_SOURCE_COVERAGE_ALLOW_DB_READ !== "1") {
    throw new Error("Set CATALOG_SOURCE_COVERAGE_ALLOW_DB_READ=1 for this read-only audit");
  }
  const url = process.env.CATALOG_SOURCE_COVERAGE_DATABASE_URL;
  if (!url) throw new Error("CATALOG_SOURCE_COVERAGE_DATABASE_URL is required");
  return url;
}

function outputPath() {
  const output = argument("output");
  if (!output) return null;
  const path = resolve(output);
  const child = relative(artifactRoot, path);
  if (!child || child.startsWith("..") || isAbsolute(child) || !path.endsWith(".json")) {
    throw new Error("--output must be a JSON file inside artifacts/catalog-v2-source-coverage");
  }
  return path;
}

async function main() {
  const sourceKey = argument("source")?.toLowerCase();
  if (!sourceKey) throw new Error("--source=<source-key> is required");
  const client = new PrismaClient({ datasources: { db: { url: assertSafeRead() } } });
  try {
    let cursor: string | null = null;
    let source: Awaited<ReturnType<typeof readShopCatalogSourceCoveragePage>>["source"] | null = null;
    const records = [] as NonNullable<Awaited<ReturnType<typeof readShopCatalogSourceCoveragePage>>>["records"];
    do {
      const page = await readShopCatalogSourceCoveragePage(client, {
        sourceKey,
        afterRecordId: cursor,
        limit: 500,
      });
      if (!page) throw new Error(`Unknown catalog source: ${sourceKey}`);
      source = page.source;
      records.push(...page.records);
      cursor = page.nextRecordId;
    } while (cursor);

    const totalLeaves = records.reduce((sum, record) => sum + record.rawLeafCount, 0);
    const accountedLeaves = records.reduce((sum, record) => sum + record.accountedLeafCount, 0);
    const report = {
      version: 1,
      generatedAt: new Date().toISOString(),
      source,
      activationReady: records.length > 0 && records.every((record) => record.activationReady),
      recordCount: records.length,
      readyRecordCount: records.filter((record) => record.activationReady).length,
      coveragePercent: totalLeaves ? Math.round((accountedLeaves / totalLeaves) * 10_000) / 100 : 0,
      rawLeafCount: totalLeaves,
      accountedLeafCount: accountedLeaves,
      missingLeafCount: records.reduce((sum, record) => sum + record.missingLeafCount, 0),
      invalidProvenanceCount: records.reduce((sum, record) => sum + record.invalidProvenanceCount, 0),
      quarantinedLeafCount: records.reduce((sum, record) => sum + record.quarantinedLeafCount, 0),
      openIssueCount: records.reduce((sum, record) => sum + record.openIssueCount, 0),
      blockedRecords: records.filter((record) => !record.activationReady),
      fingerprint: createHash("sha256")
        .update(records.map((record) => `${record.id}:${record.fingerprint ?? "missing"}`).join("\n"))
        .digest("hex"),
    };
    const target = outputPath();
    if (target) {
      await mkdir(resolve(target, ".."), { recursive: true });
      await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
    if (!report.activationReady) process.exitCode = 2;
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
