import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { buildKwVehicleMakeEvidence, normalizeKwShopifyProduct } from "../src/lib/shopCatalogKwNormalization";
import {
  parseShopifyProductJsonl,
  parseShopifyProductTranslationMap,
  selectKwShopifyProducts,
} from "../src/lib/shopifyCatalogSnapshot";

async function main() {
  const productPath = process.argv[2];
  const translationPath = process.argv[3];
  if (!productPath || !translationPath) {
    throw new TypeError("Usage: tsx scripts/audit-kw-product-drafts.ts <products.jsonl> <translations-en.jsonl> [report.json]");
  }
  const outputPath = process.argv[4] ?? `${productPath}.kw-drafts.json`;
  const products = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(resolve(productPath), "utf8")));
  const translations = parseShopifyProductTranslationMap(await readFile(resolve(translationPath), "utf8"));
  const evidence = buildKwVehicleMakeEvidence(products);
  const drafts = products.map((product) => buildKwCanonicalProductDraft({
    product,
    normalization: normalizeKwShopifyProduct(product, evidence),
    enTranslations: translations.get(product.id),
  }));
  const countBy = (values: readonly string[]) => values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
  const issueCounts = countBy(drafts.flatMap((draft) => draft.issues));
  const duplicateValues = (values: readonly string[]) => Object.entries(countBy(values)).filter(([, count]) => count > 1).map(([value]) => value).sort();
  const report = {
    schemaVersion: 1,
    sourceProducts: products.length,
    canonicalDrafts: drafts.length,
    variants: drafts.reduce((total, draft) => total + draft.variants.length, 0),
    media: drafts.reduce((total, draft) => total + draft.media.length, 0),
    metafields: drafts.reduce((total, draft) => total + draft.metafields.length, 0),
    options: drafts.reduce((total, draft) => total + draft.options.length, 0),
    publishableNow: drafts.filter((draft) => draft.issues.length === 0).length,
    heldForReview: drafts.filter((draft) => draft.issues.length > 0).length,
    duplicateSlugs: duplicateValues(drafts.map((draft) => draft.product.slug)),
    duplicateVariantSkus: duplicateValues(drafts.flatMap((draft) => draft.variants.map((variant) => variant.sku).filter((sku): sku is string => Boolean(sku)))),
    issueCounts,
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
