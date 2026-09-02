import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { normalizeKwShopifyCatalog } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new TypeError("Usage: tsx scripts/audit-kw-normalization.ts <snapshot.jsonl> [report.json]");
  const outputPath = process.argv[3] ?? `${sourcePath}.kw-normalization.json`;
  const selected = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(resolve(sourcePath), "utf8")));
  const normalized = normalizeKwShopifyCatalog(selected);
  const issueCounts: Record<string, number> = {};
  for (const product of normalized) {
    for (const issue of product.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  }
  const applications = normalized.flatMap((product) => product.applications);
  const report = {
    schemaVersion: 1,
    sourceProducts: selected.length,
    normalizedProducts: normalized.length,
    applications: applications.length,
    verifiedApplications: applications.filter((application) => application.verification === "VERIFIED").length,
    inferredApplications: applications.filter((application) => application.verification === "INFERRED").length,
    reviewApplications: applications.filter((application) => application.verification === "NEEDS_REVIEW").length,
    productsReadyForProjection: normalized.filter((product) => product.issues.length === 0).length,
    productsNeedingReview: normalized.filter((product) => product.issues.length > 0).length,
    issueCounts,
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
