// Read-only supplier snapshot audit. Run after saving Shopify products.json pages:
// node scripts/audit-burger-repricing.mjs YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  throw new Error('Pass the supplier snapshot date as YYYY-MM-DD');
}

const tunerTypes = new Set(['JB4 Tuners', 'JB+ Tuners', 'Stage 1 Tuners']);
const inputDir = path.join(process.cwd(), 'tmp');
const files = fs.readdirSync(inputDir)
  .filter((name) => name.startsWith(`burger-products-${date}-page`) && name.endsWith('.json'))
  .sort((a, b) => Number(a.match(/page(\d+)/)?.[1]) - Number(b.match(/page(\d+)/)?.[1]));
if (!files.length) throw new Error(`No Burger supplier pages found for ${date}`);

const products = files.flatMap((file) =>
  JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8')).products ?? []
);
const local = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/burger-products.json'), 'utf8'));
const localByHandle = new Map(local.map((product) => [product.slug, product]));
// Include every Burger product, including JB4/JB+/Stage 1 tuner families.
const relevant = products;
const skuCounts = new Map();
for (const product of relevant) {
  for (const variant of product.variants ?? []) {
    const sku = String(variant.sku ?? '').trim().toUpperCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }
}

const rows = relevant.flatMap((product) => (product.variants ?? []).map((variant) => {
  const sku = String(variant.sku ?? '').trim();
  const localProduct = localByHandle.get(product.handle);
  const grams = Number(variant.grams ?? 0);
  const price = Number(variant.price);
  const compareAt = variant.compare_at_price == null ? null : Number(variant.compare_at_price);
  const regularPrice = Number.isFinite(compareAt) && compareAt > price ? compareAt : price;
  const flags = [];
  if (!localProduct) flags.push('NOT_IN_LOCAL_SNAPSHOT');
  if (!sku) flags.push('NO_SUPPLIER_SKU');
  if (sku && skuCounts.get(sku.toUpperCase()) > 1) flags.push('DUPLICATE_SUPPLIER_SKU');
  if (!Number.isFinite(price) || price <= 0) flags.push('NO_SUPPLIER_PRICE');
  if (Number.isFinite(compareAt) && compareAt > 0 && compareAt < price) {
    flags.push('COMPARE_AT_BELOW_VARIANT_PRICE');
  }
  if (!Number.isFinite(grams) || grams <= 0) flags.push('NO_SOURCE_WEIGHT');
  else if (grams < 100) flags.push('VERY_LOW_SOURCE_WEIGHT');
  if (variant.available === false) flags.push('UNAVAILABLE_AT_SOURCE');
  if ((product.variants?.length ?? 0) > 1 &&
      new Set(product.variants.map((item) => Number(item.grams ?? 0))).size === 1 &&
      /\b(?:add|include|upgrade|without|with or without)\b/i.test(
        product.variants.map((item) => item.title).join(' ')
      )) {
    flags.push('ADDON_WEIGHT_REVIEW');
  }
  const description = String(product.body_html ?? '').replace(/<[^>]+>/g, ' ');
  if ((product.variants?.length ?? 0) > 1 &&
      /\b(?:all|includes?|included|comes with|complete kit|with or without)\b/i.test(description)) {
    flags.push('VARIANT_SCOPE_COPY_REVIEW');
  }
  if (/\bfree shipping\b/i.test(description)) flags.push('SUPPLIER_SHIPPING_COPY_REVIEW');

  return {
    productHandle: product.handle,
    sourceUrl: `https://burgertuning.com/products/${product.handle}`,
    onecompanyUrl: `https://onecompany.global/ua/shop/burger/products/burger-${product.handle}`,
    productTitle: product.title,
    productType: product.product_type,
    sourceProductId: product.id,
    sourceVariantId: variant.id,
    variantTitle: variant.title,
    option1: variant.option1,
    option2: variant.option2,
    option3: variant.option3,
    supplierSku: sku,
    internalKey: `BURGER-V-${variant.id}`,
    supplierPriceUsd: Number.isFinite(price) ? price.toFixed(2) : '',
    supplierCompareAtUsd: Number.isFinite(compareAt) ? compareAt.toFixed(2) : '',
    regularSupplierUsd: Number.isFinite(regularPrice) ? regularPrice.toFixed(2) : '',
    sourceWasDiscounted: Number.isFinite(compareAt) && compareAt > price,
    sourceGrams: Number.isFinite(grams) ? grams : '',
    available: variant.available !== false,
    localSelectedSku: localProduct?.sku ?? '',
    localSelectedVariant: localProduct?.selectedVariant ?? '',
    flags: flags.join('|'),
  };
}));

const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const headers = Object.keys(rows[0] ?? {});
const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))].join('\n');
const output = path.join(inputDir, `burger-variant-audit-${date}.csv`);
fs.writeFileSync(output, `\uFEFF${csv}\n`, 'utf8');

const configurationPreview = relevant.map((product) => ({
  sourceProductId: product.id,
  handle: product.handle,
  title: product.title,
  productType: product.product_type,
  sourceUrl: `https://burgertuning.com/products/${product.handle}`,
  descriptionEnSource: product.body_html ?? '',
  options: (product.options ?? []).map((option) => ({
    name: option.name,
    position: option.position,
    values: option.values ?? [],
  })),
  variants: (product.variants ?? []).map((variant) => {
    const salePrice = Number(variant.price);
    const compareAt = variant.compare_at_price == null ? null : Number(variant.compare_at_price);
    return {
      sourceVariantId: variant.id,
      title: variant.title,
      optionValues: [variant.option1, variant.option2, variant.option3].filter(Boolean),
      supplierSku: String(variant.sku ?? '').trim() || null,
      internalKey: `BURGER-V-${variant.id}`,
      salePriceUsd: salePrice,
      compareAtUsd: Number.isFinite(compareAt) ? compareAt : null,
      regularSupplierUsd: Math.max(salePrice, Number.isFinite(compareAt) ? compareAt : 0),
      sourceGrams: Number(variant.grams ?? 0),
      available: variant.available !== false,
    };
  }),
}));
const configurationOutput = path.join(inputDir, `burger-configurations-${date}.json`);
fs.writeFileSync(configurationOutput, JSON.stringify(configurationPreview, null, 2) + '\n');

const flagCounts = Object.fromEntries(
  [...new Set(rows.flatMap((row) => row.flags.split('|').filter(Boolean)))].map((flag) => [
    flag, rows.filter((row) => row.flags.split('|').includes(flag)).length,
  ])
);
const summary = {
  sourceProducts: products.length,
  excludedTunerProducts: 0,
  tunerProductsIncluded: relevant.filter((product) => tunerTypes.has(product.product_type)).length,
  includedProducts: relevant.length,
  includedVariants: rows.length,
  discountedVariants: rows.filter((row) => row.sourceWasDiscounted).length,
  discountedProducts: new Set(rows.filter((row) => row.sourceWasDiscounted)
    .map((row) => row.productHandle)).size,
  localProductsWithoutSource: local.filter((product) =>
    !products.some((source) => source.handle === product.slug)
  ).length,
  flags: flagCounts,
  output,
  configurationOutput,
};
fs.writeFileSync(path.join(inputDir, `burger-variant-audit-${date}.json`),
  JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
