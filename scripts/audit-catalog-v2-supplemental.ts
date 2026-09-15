import { SHOP_CATALOG_SUPPLEMENTAL_SOURCES } from "../src/lib/shopCatalogSupplementalNormalization";
import { loadSupplementalCatalogDrafts } from "./catalog-v2-supplemental-source";

async function main() {
  const reports = [];
  for (const source of Object.keys(SHOP_CATALOG_SUPPLEMENTAL_SOURCES)) {
    const drafts = await loadSupplementalCatalogDrafts(
      source as keyof typeof SHOP_CATALOG_SUPPLEMENTAL_SOURCES
    );
    if (!drafts.length) throw new Error(`${source} supplemental partition is empty`);
    reports.push({
      source,
      records: drafts.length,
      needsReview: drafts.filter((draft) => draft.normalization.verification === "NEEDS_REVIEW")
        .length,
      provenanceEntries: drafts.reduce((sum, draft) => sum + draft.provenance.length, 0),
      issueEntries: drafts.reduce((sum, draft) => sum + draft.issues.length, 0),
      fingerprint: drafts
        .map((draft) => draft.sourceRecord.payloadHash)
        .sort()
        .join("")
        .slice(0, 64),
    });
  }
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        sources: reports.length,
        records: reports.reduce((sum, report) => sum + report.records, 0),
        reports,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
