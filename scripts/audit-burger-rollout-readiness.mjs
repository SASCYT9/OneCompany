// Read-only coverage gate for the local Burger catalog preview.
// Run: node scripts/audit-burger-rollout-readiness.mjs YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('Pass YYYY-MM-DD');
const root = process.cwd();
const tmp = path.join(root, 'tmp');
const source = JSON.parse(fs.readFileSync(path.join(tmp, `burger-configurations-${date}.json`), 'utf8'));
const drafts = JSON.parse(fs.readFileSync(path.join(tmp, `burger-copy-drafts-${date}.json`), 'utf8'));
const candidate = JSON.parse(fs.readFileSync(path.join(tmp, `burger-import-candidate-${date}.json`), 'utf8'));
const candidateByHandle = new Map(candidate.products.map((item) => [item.slug, item]));
const fallbackDir = path.join(root, 'public', 'catalog-fallback');
const fallbackManifest = JSON.parse(fs.readFileSync(path.join(fallbackDir, 'manifest.json'), 'utf8'));
const shard = fallbackManifest.stores?.burger?.file;
if (!shard) throw new Error('Burger fallback shard not found');
const preview = JSON.parse(fs.readFileSync(path.join(fallbackDir, shard), 'utf8'));
const previewBySlug = new Map(preview.map((item) => [item.slug, item]));

const rows = source.map((item) => {
  const slug = `burger-${item.handle}`;
  const local = previewBySlug.get(slug);
  const draft = drafts[item.handle];
  const candidateProduct = candidateByHandle.get(item.handle);
  const expectedIds = new Set(item.variants.map((variant) => `burger-preview-${variant.sourceVariantId}`));
  const actual = local?.variants ?? [];
  const internalOptionOnly = candidateProduct?.internalOptionOnly === true;
  const manualQuoteRequired = candidateProduct?.manualQuoteRequired === true;
  const digitalProduct = candidateProduct?.requiresShipping === false && !internalOptionOnly;
  const variantIdentitiesComplete = Boolean(local && expectedIds.size > 0 &&
    actual.length === expectedIds.size &&
    actual.every((variant) => expectedIds.has(variant.id) && Boolean(variant.sku)));
  const pricedForAutomaticCatalog = Boolean(variantIdentitiesComplete && !internalOptionOnly &&
    !manualQuoteRequired && actual.every((variant) => variant.price?.usd > 0 &&
      (digitalProduct || variant.weightKg > 0)));
  const configured = internalOptionOnly || (manualQuoteRequired && variantIdentitiesComplete) ||
    pricedForAutomaticCatalog;
  const optionLabelCorrections = candidateProduct?.optionLabelCorrections ?? [];
  const correctedOptions = candidateProduct?.options ?? [];
  const optionsComplete = configured && (item.variants.length === 1 ||
    JSON.stringify(local.options ?? []) === JSON.stringify(correctedOptions));
  const copyOnPreview = Boolean(draft && local &&
    local.title?.ua === draft.titleUa && local.title?.en === draft.titleEn &&
    local.longDescription?.ua === draft.descUa && local.longDescription?.en === draft.descEn);
  const issues = [];
  if (!local) issues.push('MISSING_LOCAL_PRODUCT');
  if (!draft) issues.push('COPY_NOT_DRAFTED');
  else if (!copyOnPreview) issues.push('COPY_NOT_ON_LOCAL_PREVIEW');
  if (!configured) issues.push('VARIANTS_OR_PRICES_NOT_PREPARED');
  else if (!optionsComplete) issues.push('OPTION_AXES_INCOMPLETE');
  return {
    handle: item.handle,
    sourceUrl: item.sourceUrl,
    previewUrl: `http://localhost:3000/ua/shop/burger/products/${slug}`,
    sourceVariantCount: item.variants.length,
    localProductPresent: Boolean(local),
    copyDrafted: Boolean(draft),
    copyOnPreview,
    internalOptionOnly,
    manualQuoteRequired,
    digitalProduct,
    variantsAndPricesPrepared: pricedForAutomaticCatalog,
    optionsComplete,
    optionValueCorrections: candidateProduct?.optionValueCorrections?.length ?? 0,
    optionLabelCorrections: optionLabelCorrections.map((entry) =>
      `${entry.sourceLabel} -> ${entry.displayLabel} (${entry.reason})`
    ).join('; '),
    issues: issues.join('|'),
  };
});

const tunerTypes = new Set(['JB4 Tuners', 'JB+ Tuners', 'Stage 1 Tuners']);
const sourceFiles = fs.readdirSync(tmp).filter((name) =>
  name.startsWith(`burger-products-${date}-page`) && name.endsWith('.json'));
const tunerHandles = sourceFiles.flatMap((name) =>
  JSON.parse(fs.readFileSync(path.join(tmp, name), 'utf8')).products ?? [])
  .filter((item) => tunerTypes.has(item.product_type))
  .map((item) => `burger-${item.handle}`);
const tunerConfigured = rows.filter((row) =>
  tunerHandles.includes(`burger-${row.handle}`) && row.variantsAndPricesPrepared && row.optionsComplete
).length;

const summary = {
  sourceProducts: source.length,
  sourceVariants: source.reduce((total, item) => total + item.variants.length, 0),
  localProductsPresent: rows.filter((row) => row.localProductPresent).length,
  publicCatalogProducts: rows.filter((row) => !row.internalOptionOnly).length,
  internalOptionOnlyProducts: rows.filter((row) => row.internalOptionOnly).length,
  productsRequiringManualQuote: rows.filter((row) => row.manualQuoteRequired).length,
  productsWithBrandFacet: preview.filter((item) => !(item.tags ?? []).includes('catalog:hidden') &&
    (item.tags ?? []).some((tag) => tag.startsWith('brand:'))).length,
  productsWithModelFacet: preview.filter((item) => !(item.tags ?? []).includes('catalog:hidden') &&
    (item.tags ?? []).some((tag) => tag.startsWith('model:'))).length,
  productsWithChassisFacet: preview.filter((item) => !(item.tags ?? []).includes('catalog:hidden') &&
    (item.tags ?? []).some((tag) => tag.startsWith('chassis:'))).length,
  copyDrafted: rows.filter((row) => row.copyDrafted).length,
  copyOnPreview: rows.filter((row) => row.copyOnPreview).length,
  variantsAndPricesPrepared: rows.filter((row) => row.variantsAndPricesPrepared).length,
  optionsComplete: rows.filter((row) => row.optionsComplete).length,
  productsWithAutomaticPricingReady: rows.filter((row) => !row.internalOptionOnly &&
    !row.manualQuoteRequired && row.variantsAndPricesPrepared && row.optionsComplete).length,
  tunerProductsIncluded: tunerHandles.length,
  tunerProductsConfigured: tunerConfigured,
  readyForFullImport: rows.every((row) => row.copyDrafted && row.optionsComplete &&
    !row.manualQuoteRequired && !row.internalOptionOnly && row.variantsAndPricesPrepared),
  readinessNotes: [
    'Manual-invoice listings need an individual supplier quote before importing a price.',
    'Internal Product Options/service records stay out of public search and are not standalone catalog items.',
    'Digital maps use regular-price markup without parcel weight or physical shipping.',
  ],
};
const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const headers = Object.keys(rows[0] ?? {});
const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => quote(row[key])).join(','))].join('\n');
fs.writeFileSync(path.join(tmp, `burger-rollout-readiness-${date}.csv`), `\uFEFF${csv}\n`);
fs.writeFileSync(path.join(tmp, `burger-rollout-readiness-${date}.json`),
  JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--require-complete') && !summary.readyForFullImport) process.exitCode = 1;
