import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import {
  buildRaceChipSourceRecordDraft,
  normalizeRaceChipSnapshotProduct,
  type RaceChipSnapshotProduct,
} from "../src/lib/shopCatalogRaceChipNormalization";
import { buildShopCatalogSourceRecordCoverage } from "../src/lib/shopCatalogSourceCoverage";

async function main() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    stores?: Record<string, { file?: string; count?: number }>;
  };
  const descriptor = manifest.stores?.racechip;
  if (!descriptor?.file || !Number.isSafeInteger(descriptor.count)) {
    throw new Error("Catalog fallback manifest has no valid RaceChip shard");
  }
  const shardPath = resolve(dirname(manifestPath), descriptor.file);
  const raw = await readFile(shardPath, "utf8");
  const expectedHash = /\.([a-f0-9]{12})\.json$/i.exec(descriptor.file)?.[1];
  const actualHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  if (expectedHash && expectedHash !== actualHash) throw new Error("RaceChip shard hash mismatch");
  const products = JSON.parse(raw) as RaceChipSnapshotProduct[];
  if (!Array.isArray(products) || products.length !== descriptor.count) {
    throw new Error("RaceChip shard count does not match manifest");
  }
  const normalized = products.map(normalizeRaceChipSnapshotProduct);
  let rawLeafCount = 0;
  let provenanceCount = 0;
  let losslessCoverageRecords = 0;
  let auditedLegacyScopeRecords = 0;
  for (const product of products) {
    const draft = buildRaceChipSourceRecordDraft({ product, sourceRevision: actualHash });
    const coverage = buildShopCatalogSourceRecordCoverage({
      recordKey: draft.sourceRecord.recordKey,
      rawPayload: product,
      provenance: draft.provenance,
    });
    rawLeafCount += coverage.leafCount;
    provenanceCount += draft.provenance.length;
    if (coverage.coveragePercent === 100 && coverage.activationReady) losslessCoverageRecords += 1;
    if (draft.provenance.some((entry) => entry.fieldPath === "scope" && entry.reason)) {
      auditedLegacyScopeRecords += 1;
    }
  }
  const issueCounts = new Map<string, number>();
  for (const item of normalized) {
    for (const issue of item.issues) issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }
  const duplicateValues = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const duplicates = [...counts]
      .filter(([, count]) => count > 1)
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
    return { valueCount: duplicates.length, affectedRecords: duplicates.reduce((sum, item) => sum + item.count, 0), samples: duplicates.slice(0, 25) };
  };
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    immutableInput: {
      manifest: manifestPath,
      shard: shardPath,
      count: products.length,
      hash: actualHash,
    },
    verified: normalized.filter((item) => item.verification === "VERIFIED").length,
    needsReview: normalized.filter((item) => item.verification === "NEEDS_REVIEW").length,
    losslessCoverage: {
      records: losslessCoverageRecords,
      rawLeaves: rawLeafCount,
      provenanceEntries: provenanceCount,
      auditedLegacyScopeRecords,
    },
    fuel: {
      diesel: normalized.filter((item) => item.fuel === "diesel").length,
      petrol: normalized.filter((item) => item.fuel === "petrol").length,
      hybrid: normalized.filter((item) => item.fuel === "hybrid").length,
      unknown: normalized.filter((item) => item.fuel == null).length,
    },
    generationKnown: normalized.filter((item) => item.generation != null).length,
    yearKnown: normalized.filter((item) => item.yearFrom != null).length,
    issues: Object.fromEntries([...issueCounts].sort(([left], [right]) => left.localeCompare(right))),
    duplicates: {
      productIds: duplicateValues(normalized.map((item) => item.productId)),
      recordKeys: duplicateValues(normalized.map((item) => item.recordKey)),
      variantIds: duplicateValues(normalized.map((item) => item.variantId)),
      variantSkus: duplicateValues(normalized.map((item) => item.variantSku)),
    },
    fingerprint: createHash("sha256")
      .update(normalized.map((item) => `${item.productId}:${item.configurationKey}:${item.verification}`).sort().join("\n"))
      .digest("hex"),
  };
  const outputArg = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
  if (outputArg) {
    const output = resolve(outputArg);
    const root = resolve("artifacts", "catalog-v2-racechip");
    const child = relative(root, output);
    if (!child || child.startsWith("..") || isAbsolute(child) || !output.endsWith(".json")) {
      throw new Error("--output must be inside artifacts/catalog-v2-racechip");
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
