/**
 * Apply manual UA translations to scraped Ilmberger product data.
 *
 * Reads:
 *   tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json (scraped products)
 *   tmp/ua-translations.json (manual UA titles by SKU)
 *
 * Writes back to scraped file: titleUa from translations, descriptionHtmlUa
 * built from a universal UA template that adapts to product type/category.
 *
 * Run: node scripts/ilmberger/apply-translations.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { buildUaDescription } from "./description.mjs";

const PRODUCTS_PATH = "tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json";
const TRANSLATIONS_PATH = "tmp/ua-translations.json";

const products = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8"));
const translations = JSON.parse(readFileSync(TRANSLATIONS_PATH, "utf-8"));

let titlesUpdated = 0;
let descUpdated = 0;

for (const p of products) {
  const t = translations[p.sku];
  if (t?.titleUa) {
    p.titleUa = t.titleUa;
    titlesUpdated++;
  } else {
    console.log(`  ⚠ No UA title for ${p.sku} — using EN fallback`);
  }
  // Always rebuild descriptionHtmlUa — translates the real EN body via
  // phrase dictionary (preserves HTML tags + per-product specifics).
  p.descriptionHtmlUa = buildUaDescription({
    titleUa: p.titleUa ?? p.titleEn,
    sku: p.sku,
    titleEn: p.titleEn,
    descriptionHtmlEn: p.descriptionHtmlEn,
  });
  descUpdated++;
}

writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2));
console.log(`✅ Updated ${titlesUpdated}/${products.length} titleUa`);
console.log(`✅ Updated ${descUpdated}/${products.length} descriptionHtmlUa (from template)`);
