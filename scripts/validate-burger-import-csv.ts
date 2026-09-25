#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildProductsFromShopifyCsv } from "../src/lib/shopAdminCsv";
import { sanitizeRichTextHtml } from "../src/lib/sanitizeRichTextHtml";

type CandidateVariant = {
  title: string;
  priceUsd: number | null;
  optionValues: string[];
  packageWeightKg: number | null;
  packageDimensionsCm: { length: number; width: number; height: number };
  requiresShipping: boolean;
  available: boolean;
};
type CandidateProduct = {
  slug: string;
  title: { ua: string; en: string };
  descriptionUa: string;
  descriptionEn: string;
  internalOptionOnly?: boolean;
  manualQuoteRequired?: boolean;
  variants: CandidateVariant[];
};

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Pass YYYY-MM-DD");
const root = process.cwd();
const tmpDir = path.join(root, "tmp");
const candidate = JSON.parse(fs.readFileSync(path.join(tmpDir, `burger-import-candidate-${date}.json`), "utf8")) as {
  summary: { sourceProducts: number };
  products: CandidateProduct[];
};
const exportDir = path.join(tmpDir, `burger-import-csv-${date}`);
const manifest = JSON.parse(fs.readFileSync(path.join(exportDir, "manifest.json"), "utf8")) as {
  productCount: number;
  variantCount: number;
  internalOnlyProducts: number;
  manualQuoteProducts: number;
  batches: Array<{ file: string; products: number; variants: number; bytes: number }>;
  currencyRates: { EUR: number; USD: number; UAH: number };
};
const normalizeSlug = (value: string) => value.toLowerCase().replace(/[\s_]+/g, "-")
  .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
const candidateBySlug = new Map<string, CandidateProduct>(
  candidate.products.map((product) => [normalizeSlug(product.slug), product])
);
let productCount = 0;
let variantCount = 0;
let automaticPricedVariants = 0;
let quoteVariants = 0;
let internalProducts = 0;

for (const batch of manifest.batches) {
  const csv = fs.readFileSync(path.join(exportDir, batch.file), "utf8");
  const parsed = buildProductsFromShopifyCsv(csv);
  assert.deepEqual(parsed.errors, [], `CSV errors in ${batch.file}`);
  assert.equal(parsed.products.length, batch.products, `Product count mismatch in ${batch.file}`);
  assert.equal(parsed.variantsCount, batch.variants, `Variant count mismatch in ${batch.file}`);
  productCount += parsed.products.length;
  variantCount += parsed.variantsCount;

  for (const imported of parsed.products) {
    const source = candidateBySlug.get(normalizeSlug(imported.slug.replace(/^burger-/, "")));
    assert.ok(source, `Unexpected CSV handle: ${imported.slug}`);
    assert.equal(imported.variants.length, source.variants.length, `Variant count: ${imported.slug}`);
    assert.equal(imported.titleUa, source.title.ua, `UA title: ${imported.slug}`);
    assert.equal(imported.titleEn, source.title.en, `EN title: ${imported.slug}`);
    assert.equal(imported.bodyHtmlUa, sanitizeRichTextHtml(source.descriptionUa), `UA body: ${imported.slug}`);
    assert.equal(imported.bodyHtmlEn, sanitizeRichTextHtml(source.descriptionEn), `EN body: ${imported.slug}`);
    assert.equal(imported.isPublished, source.internalOptionOnly !== true, `Visibility: ${imported.slug}`);
    assert.equal(imported.status, source.internalOptionOnly ? "DRAFT" : "ACTIVE", `Status: ${imported.slug}`);

    if (source.internalOptionOnly) internalProducts += 1;
    for (let index = 0; index < source.variants.length; index += 1) {
      const expected = source.variants[index];
      const actual = imported.variants[index];
      if (source.manualQuoteRequired || source.internalOptionOnly) {
        assert.equal(actual.priceUsd, null, `Quote USD should be blank: ${imported.slug} #${index + 1}`);
        assert.equal(actual.priceEur, null, `Quote EUR should be blank: ${imported.slug} #${index + 1}`);
        assert.equal(actual.priceUah, null, `Quote UAH should be blank: ${imported.slug} #${index + 1}`);
        if (source.manualQuoteRequired) quoteVariants += 1;
      } else {
        assert.equal(actual.priceUsd, expected.priceUsd, `USD: ${imported.slug} #${index + 1}`);
        const expectedEur = Math.round((expected.priceUsd! / manifest.currencyRates.USD) * manifest.currencyRates.EUR * 100) / 100;
        const expectedUah = Math.round((expected.priceUsd! / manifest.currencyRates.USD) * manifest.currencyRates.UAH * 100) / 100;
        assert.equal(actual.priceEur, expectedEur, `EUR: ${imported.slug} #${index + 1}`);
        assert.equal(actual.priceUah, expectedUah, `UAH: ${imported.slug} #${index + 1}`);
        automaticPricedVariants += 1;
      }
      assert.deepEqual(
        [actual.option1Value, actual.option2Value, actual.option3Value]
          .filter((value) => Boolean(value) && value !== "Default Title"),
        expected.optionValues.filter((value) => value !== "Default Title"),
        `Options: ${imported.slug} #${index + 1}`
      );
      assert.equal(actual.requiresShipping, expected.requiresShipping, `Shipping: ${imported.slug} #${index + 1}`);
      assert.equal(actual.inventoryQty, source.internalOptionOnly ? 0 : expected.available ? 999 : 0,
        `Availability: ${imported.slug} #${index + 1}`);
      if (expected.requiresShipping && expected.packageWeightKg != null) {
        const expectedWeight = Math.ceil((expected.packageWeightKg - 1e-9) * 100) / 100;
        assert.equal(actual.weight, expectedWeight, `Package weight: ${imported.slug} #${index + 1}`);
        assert.equal(actual.length, expected.packageDimensionsCm.length, `Package length: ${imported.slug} #${index + 1}`);
        assert.equal(actual.width, expected.packageDimensionsCm.width, `Package width: ${imported.slug} #${index + 1}`);
        assert.equal(actual.height, expected.packageDimensionsCm.height, `Package height: ${imported.slug} #${index + 1}`);
      }
    }
  }
}

assert.equal(productCount, manifest.productCount, "Total product count");
assert.equal(variantCount, manifest.variantCount, "Total variant count");
assert.equal(internalProducts, manifest.internalOnlyProducts, "Internal product count");
assert.equal(quoteVariants, 11, "Manual-quote variant count");
assert.ok(manifest.batches.every((batch) => batch.bytes < 4_000_000), "Every upload batch must stay below 4 MB");
console.log(JSON.stringify({
  csvProductsValidated: productCount,
  csvVariantsValidated: variantCount,
  automaticPricedVariants,
  manualQuoteVariants: quoteVariants,
  hiddenInternalProducts: internalProducts,
  batchesValidated: manifest.batches.length,
  valid: true,
}, null, 2));
