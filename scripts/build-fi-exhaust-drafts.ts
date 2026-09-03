import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildFiCanonicalDraft, type FiFitmentEntry, type FiSourceProduct } from "../src/lib/shopCatalogFiDraft";

const ROOT = resolve("backups/shopify/fi-exhaust/2026-09-03");

async function main() {
  const products = JSON.parse(await readFile(resolve(ROOT, "products.json"), "utf8")) as FiSourceProduct[];
  const fitmentDocument = JSON.parse(await readFile(resolve(ROOT, "fitment-map.json"), "utf8")) as { products: FiFitmentEntry[] };
  const fitments = new Map(fitmentDocument.products.map((entry) => [entry.handle, entry]));
  const drafts = products.map((product) => {
    const fitment = fitments.get(product.handle);
    if (!fitment) throw new Error(`Missing fitment for ${product.handle}`);
    return buildFiCanonicalDraft(product, fitment);
  });
  const blocking = drafts.filter((draft) => draft.issues.some((issue) => issue !== "images_missing"));
  const report = {
    products: drafts.length,
    variants: drafts.reduce((sum, draft) => sum + draft.variants.length, 0),
    images: drafts.reduce((sum, draft) => sum + draft.media.filter((media) => media.mediaType === "IMAGE").length, 0),
    videos: drafts.reduce((sum, draft) => sum + draft.media.filter((media) => media.mediaType === "EXTERNAL_VIDEO").length, 0),
    applications: drafts.reduce((sum, draft) => sum + draft.applications.length, 0),
    cyrillicTitles: drafts.filter((draft) => /[\u0400-\u04ff]/u.test(draft.product.titleEn)).length,
    cyrillicBodies: drafts.filter((draft) => /[\u0400-\u04ff]/u.test(draft.product.bodyHtmlEn)).length,
    missingEnglish: drafts.filter((draft) => !draft.product.titleEn || !draft.product.bodyHtmlEn).length,
    issueCounts: Object.fromEntries([...new Set(drafts.flatMap((draft) => draft.issues))].sort().map((issue) => [issue, drafts.filter((draft) => draft.issues.includes(issue)).length])),
    blocking: blocking.length,
  };
  await writeFile(resolve(ROOT, "canonical-drafts.json"), `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
  await writeFile(resolve(ROOT, "canonical-drafts-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (blocking.length || report.cyrillicTitles || report.cyrillicBodies || report.missingEnglish) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
