import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { kwNormalizationHasBlockingIssues, normalizeKwShopifyCatalog } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new TypeError("Usage: tsx scripts/audit-kw-normalization.ts <snapshot.jsonl> [report.json]");
  const outputPath = process.argv[3] ?? `${sourcePath}.kw-normalization.json`;
  const selected = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(resolve(sourcePath), "utf8")));
  const normalized = normalizeKwShopifyCatalog(selected);
  const issueCounts: Record<string, number> = {};
  const issueSamples: Record<string, Array<{ id: string; title: string; productType: string | null; tags: string[]; applications: typeof normalized[number]["applications"] }>> = {};
  for (let index = 0; index < normalized.length; index += 1) {
    const product = normalized[index]!;
    for (const issue of product.issues) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      const samples = issueSamples[issue] ?? [];
      if (samples.length < 20) {
        const source = selected[index]!;
        samples.push({ id: source.id, title: String(source.title ?? ""), productType: source.productType ?? null, tags: source.tags ?? [], applications: product.applications });
        issueSamples[issue] = samples;
      }
    }
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
    productsReadyForProjection: normalized.filter((product) => !kwNormalizationHasBlockingIssues(product)).length,
    productsNeedingReview: normalized.filter(kwNormalizationHasBlockingIssues).length,
    issueCounts,
    issueSamples,
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
