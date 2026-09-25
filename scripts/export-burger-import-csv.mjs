#!/usr/bin/env node
/**
 * Export the reviewed Burger candidate into small Shopify-compatible CSV
 * batches for the authenticated Admin Import Center. Writes only under tmp/.
 * Run: node scripts/export-burger-import-csv.mjs YYYY-MM-DD [products-per-batch]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("Pass YYYY-MM-DD");
const productsPerBatch = Number(process.argv[3] ?? 25);
if (!Number.isInteger(productsPerBatch) || productsPerBatch < 1 || productsPerBatch > 50) {
  throw new Error("Products per batch must be an integer from 1 to 50");
}

const root = process.cwd();
const tmpDir = path.join(root, "tmp");
const candidatePath = path.join(tmpDir, `burger-import-candidate-${date}.json`);
if (!fs.existsSync(candidatePath)) throw new Error(`Candidate not found: ${candidatePath}`);
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
const products = candidate.products;
if (!Array.isArray(products) || products.length !== candidate.summary.sourceProducts) {
  throw new Error("Candidate product count does not match its summary");
}

// Matches the active OneCompany shop currency table shown in Admin: EUR=53 UAH,
// USD=46 UAH. Convert from the agreed USD retail price without changing its
// $5 rounding; all three explicit price fields then stay in sync.
const rates = { EUR: 1, USD: 1.152174, UAH: 53 };
const money2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const formatMoney = (value) => value == null ? "" : money2(value).toFixed(2);
const formatWeightUp = (value) => value == null ? "" : (Math.ceil((value - 1e-9) * 100) / 100).toFixed(2);
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const headers = [
  "Handle", "Title", "Title (EN)", "Body (HTML)", "Body (HTML) (EN)",
  "Vendor", "brand (product.metafields.custom.brand)", "Type", "Type (EN)", "Tags",
  "Published", "Status", "SEO Title", "SEO Title (EN)", "SEO Description",
  "SEO Description (EN)", "Option1 Name", "Option1 Value", "Option2 Name",
  "Option2 Value", "Option3 Name", "Option3 Value", "Variant SKU", "Variant Price",
  "Variant Price USD", "Variant Price EUR", "Variant Compare At Price",
  "Variant Compare At Price USD", "Variant Compare At Price EUR", "Variant Grams",
  "Variant Inventory Qty", "Variant Inventory Policy",
  "Variant Weight", "Variant Weight Unit", "Variant Length", "Variant Width",
  "Variant Height", "Variant Dimensions Estimated", "Variant Requires Shipping",
  "Variant Image", "Image Src", "Image Alt Text", "Image Position",
];

function currencyPrices(usd, isManual) {
  if (isManual || !(Number(usd) > 0)) return { uah: "", usd: "", eur: "" };
  return {
    uah: formatMoney((Number(usd) / rates.USD) * rates.UAH),
    usd: formatMoney(Number(usd)),
    eur: formatMoney((Number(usd) / rates.USD) * rates.EUR),
  };
}

function rowsForProduct(product) {
  if (!product.variants?.length) throw new Error(`No variants: ${product.slug}`);
  const handle = `burger-${product.slug}`;
  const internal = product.internalOptionOnly === true;
  const manualQuote = product.manualQuoteRequired === true;
  const published = !internal;
  const options = [...(product.options ?? [])].sort((a, b) => a.position - b.position);
  const variantRows = product.variants.map((variant) => {
    const prices = currencyPrices(variant.priceUsd, manualQuote || internal);
    const values = variant.optionValues ?? [];
    const physical = variant.requiresShipping !== false && product.requiresShipping !== false;
    const packageKg = physical ? Number(variant.packageWeightKg ?? 0) : 0;
    const dimensions = physical ? (variant.packageDimensionsCm ?? {}) : {};
    const row = {
      Handle: handle,
      Title: product.title?.ua ?? product.slug,
      "Title (EN)": product.title?.en ?? product.slug,
      "Body (HTML)": product.descriptionUa ?? "",
      "Body (HTML) (EN)": product.descriptionEn ?? "",
      Vendor: product.vendor ?? "Burger Motorsports Inc",
      "brand (product.metafields.custom.brand)": product.brand ?? "Burger Motorsports",
      Type: product.productType ?? "PARTS",
      "Type (EN)": product.productType ?? "PARTS",
      Tags: [...new Set(product.tags ?? [])].join(", "),
      Published: published ? "TRUE" : "FALSE",
      Status: internal ? "draft" : "active",
      "SEO Title": product.seo?.titleUa ?? product.title?.ua ?? product.slug,
      "SEO Title (EN)": product.seo?.titleEn ?? product.title?.en ?? product.slug,
      "SEO Description": product.seo?.descriptionUa ?? "",
      "SEO Description (EN)": product.seo?.descriptionEn ?? "",
      "Option1 Name": options[0]?.name ?? "",
      "Option1 Value": values[0] ?? "",
      "Option2 Name": options[1]?.name ?? "",
      "Option2 Value": values[1] ?? "",
      "Option3 Name": options[2]?.name ?? "",
      "Option3 Value": values[2] ?? "",
      "Variant SKU": variant.sku ?? variant.internalKey ?? "",
      "Variant Price": prices.uah,
      "Variant Price USD": prices.usd,
      "Variant Price EUR": prices.eur,
      "Variant Compare At Price": "",
      "Variant Compare At Price USD": "",
      "Variant Compare At Price EUR": "",
      "Variant Grams": packageKg > 0 ? String(Math.ceil(packageKg * 1000)) : "",
      "Variant Inventory Qty": internal ? "0" : (variant.available === false ? "0" : "999"),
      "Variant Inventory Policy": "continue",
      "Variant Weight": packageKg > 0 ? formatWeightUp(packageKg) : "",
      "Variant Weight Unit": packageKg > 0 ? "kg" : "",
      "Variant Length": dimensions.length ? formatMoney(dimensions.length) : "",
      "Variant Width": dimensions.width ? formatMoney(dimensions.width) : "",
      "Variant Height": dimensions.height ? formatMoney(dimensions.height) : "",
      "Variant Dimensions Estimated": physical ? "TRUE" : "FALSE",
      "Variant Requires Shipping": physical ? "TRUE" : "FALSE",
      "Variant Image": variant.image ?? product.image ?? "",
      "Image Src": product.image ?? product.gallery?.[0] ?? "",
      "Image Alt Text": product.title?.en ?? product.slug,
      "Image Position": "1",
    };
    return row;
  });

  const extraImages = (product.gallery ?? []).slice(1).map((image, index) => ({
    Handle: handle,
    "Image Src": image,
    "Image Alt Text": product.title?.en ?? product.slug,
    "Image Position": String(index + 2),
  }));
  return [...variantRows, ...extraImages];
}

const seen = new Set();
for (const product of products) {
  if (seen.has(product.slug)) throw new Error(`Duplicate product slug: ${product.slug}`);
  seen.add(product.slug);
  for (const variant of product.variants) {
    const priced = Number(variant.priceUsd) > 0;
    if (!product.manualQuoteRequired && !product.internalOptionOnly && !priced) {
      throw new Error(`Missing retail price: ${product.slug} / ${variant.title}`);
    }
  }
}

const outputDir = path.join(tmpDir, `burger-import-csv-${date}`);
fs.mkdirSync(outputDir, { recursive: true });
const batches = [];
for (let offset = 0; offset < products.length; offset += productsPerBatch) {
  const group = products.slice(offset, offset + productsPerBatch);
  const lines = [headers.join(",")];
  for (const product of group) {
    for (const row of rowsForProduct(product)) {
      lines.push(headers.map((header) => csvCell(row[header])).join(","));
    }
  }
  const text = `${lines.join("\r\n")}\r\n`;
  const part = String(batches.length + 1).padStart(2, "0");
  const file = `burger-pricing-${date}-part-${part}.csv`;
  fs.writeFileSync(path.join(outputDir, file), text, "utf8");
  batches.push({
    file,
    firstProduct: group[0].slug,
    lastProduct: group.at(-1).slug,
    products: group.length,
    variants: group.reduce((sum, item) => sum + item.variants.length, 0),
    bytes: Buffer.byteLength(text),
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
  });
}

const manifest = {
  sourceDate: date,
  productCount: products.length,
  variantCount: products.reduce((sum, product) => sum + product.variants.length, 0),
  automaticPriceProducts: products.filter((item) => !item.manualQuoteRequired && !item.internalOptionOnly).length,
  manualQuoteProducts: products.filter((item) => item.manualQuoteRequired).length,
  internalOnlyProducts: products.filter((item) => item.internalOptionOnly).length,
  currencyRates: rates,
  productsPerBatch,
  batches,
};
fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
