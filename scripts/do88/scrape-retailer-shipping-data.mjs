#!/usr/bin/env node

/**
 * Read-only exact-SKU lookup of shipping weight/dimensions from do88.co.uk.
 * Values are accepted only when the product page explicitly prints its unit.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-retailer-shipping-data.mjs input.json output.json
 * Input: [{ "sku": "..." }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");
const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((item) => !item?.sku)) {
  throw new Error("Input must be an array of objects with sku");
}
const unique = new Set();
for (const target of targets) {
  const key = String(target.sku).trim().toUpperCase();
  if (unique.has(key)) throw new Error(`Duplicate SKU in input: ${target.sku}`);
  unique.add(key);
}

const BASE = "https://www.do88.co.uk";
const CONCURRENCY = 6;
const results = new Array(targets.length);
const errors = [];
let next = 0;

function htmlText(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&#([0-9]+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function unitWeight(text, apiWeight) {
  const match = text.match(/(?:shipping\s+)?weight\s*:?[\s\u00a0]*([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|lb|lbs|oz)\b/i);
  if (!match) return { raw: apiWeight || null, valueKg: null, unit: null, evidence: null };
  const value = Number.parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const valueKg = unit === "kg" ? value : unit === "g" ? value / 1000 : unit.startsWith("lb") ? value * 0.45359237 : value * 0.028349523125;
  return { raw: `${match[1]} ${unit}`, valueKg: Math.round(valueKg * 1000) / 1000, unit, evidence: match[0] };
}

function unitDimensions(text) {
  const afterAll = text.match(/(?:shipping\s+)?dimensions?\s*:?\s*([0-9.,]+)\s*[×x]\s*([0-9.,]+)\s*[×x]\s*([0-9.,]+)\s*(mm|cm|m|inches|inch|in)\b/i);
  const afterFirst = text.match(/(?:shipping\s+)?dimensions?\s*:?\s*([0-9.,]+)\s*(mm|cm|m|inches|inch|in)\s*[×x]\s*([0-9.,]+)\s*[×x]\s*([0-9.,]+)/i);
  const match = afterAll ?? afterFirst;
  if (match) {
    const values = (afterAll ? [match[1], match[2], match[3]] : [match[1], match[3], match[4]])
      .map((entry) => Number.parseFloat(entry.replace(",", ".")));
    const unit = (afterAll ? match[4] : match[2]).toLowerCase();
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) return { raw: null, lengthCm: null, widthCm: null, heightCm: null, unit: null };
    const factor = unit === "cm" ? 1 : unit === "mm" ? 0.1 : unit === "m" ? 100 : unit.startsWith("in") ? 2.54 : null;
    if (factor == null) return { raw: null, lengthCm: null, widthCm: null, heightCm: null, unit: null };
    return {
      raw: match[0],
      lengthCm: Math.round(values[0] * factor * 100) / 100,
      widthCm: Math.round(values[1] * factor * 100) / 100,
      heightCm: Math.round(values[2] * factor * 100) / 100,
      unit,
    };
  }
  return { raw: null, lengthCm: null, widthCm: null, heightCm: null, unit: null };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "OneCompany-Do88-Shipping-Audit/1.0" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from retailer catalog API`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error("Retailer API response was not an array");
  return body;
}

async function lookup(target) {
  const query = new URL("/wp-json/wc/store/v1/products", BASE);
  query.searchParams.set("search", target.sku);
  const found = await fetchJson(query.toString());
  const requestedSku = String(target.sku).trim().toUpperCase();
  const exact = found.filter((item) => String(item.sku ?? "").trim().toUpperCase() === requestedSku);
  if (exact.length > 1) throw new Error(`More than one exact SKU result (${exact.length})`);
  if (!exact.length) return { requestedSku: target.sku, exactSkuMatch: false, sourceUrl: query.toString(), weightKg: null, dimensionsCm: null };
  const product = exact[0];
  const pageResponse = await fetch(product.permalink, { headers: { "User-Agent": "OneCompany-Do88-Shipping-Audit/1.0" }, signal: AbortSignal.timeout(25_000) });
  if (!pageResponse.ok) throw new Error(`Exact SKU page HTTP ${pageResponse.status}`);
  const text = htmlText(await pageResponse.text());
  const weight = unitWeight(text, product.weight);
  const dimensions = unitDimensions(text);
  return {
    requestedSku: target.sku,
    exactSkuMatch: true,
    retailerSku: product.sku,
    title: product.name,
    permalink: product.permalink,
    sourceUrl: query.toString(),
    retailerWeightRaw: product.weight || null,
    weightKg: weight.valueKg,
    weightEvidence: weight.evidence,
    dimensions: product.dimensions ?? null,
    dimensionsCm: {
      length: dimensions.lengthCm,
      width: dimensions.widthCm,
      height: dimensions.heightCm,
    },
    dimensionsEvidence: dimensions.raw,
    explicitUnits: { weight: weight.unit, dimensions: dimensions.unit },
  };
}

async function worker() {
  while (true) {
    const index = next++;
    if (index >= targets.length) return;
    try {
      results[index] = await lookup(targets[index]);
    } catch (error) {
      errors.push({ sku: targets[index].sku, error: String(error) });
    }
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      const exact = results.filter((item) => item?.exactSkuMatch).length;
      const weighted = results.filter((item) => item?.weightKg != null).length;
      const dimensioned = results.filter((item) => item?.dimensionsCm && Object.values(item.dimensionsCm).every((value) => value != null)).length;
      console.log(`Looked up ${index + 1}/${targets.length}; exact retailer SKU ${exact}; explicit-unit weights ${weighted}; explicit-unit package dimensions ${dimensioned}; errors ${errors.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const output = {
  source: "do88.co.uk public product catalog/store API",
  retrievedAt: new Date().toISOString(),
  requested: targets.length,
  exactSkuMatches: results.filter((item) => item?.exactSkuMatch).length,
  explicitUnitWeights: results.filter((item) => item?.weightKg != null).length,
  explicitUnitPackageDimensions: results.filter((item) => item?.dimensionsCm && Object.values(item.dimensionsCm).every((value) => value != null)).length,
  errors,
  products: results.filter(Boolean),
};
const resolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolved), { recursive: true });
await fs.writeFile(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: resolved, requested: output.requested, exactSkuMatches: output.exactSkuMatches, explicitUnitWeights: output.explicitUnitWeights, explicitUnitPackageDimensions: output.explicitUnitPackageDimensions, errors: errors.length }, null, 2));
