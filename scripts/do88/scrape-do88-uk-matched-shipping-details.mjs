#!/usr/bin/env node

/**
 * Verify weight/unit/dimension fields on exact matched do88.co.uk product pages.
 * Read-only: the source is the public WooCommerce Store API export plus each
 * exact product detail page. No values are written into OneCompany.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-do88-uk-matched-shipping-details.mjs candidate.json uk-catalog.json output.json
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , candidatePath, ukCatalogPath, outputPath] = process.argv;
if (!candidatePath || !ukCatalogPath || !outputPath) throw new Error("Pass candidate.json, uk-catalog.json and output.json");
const candidate = JSON.parse(await fs.readFile(candidatePath, "utf8"));
const ukCatalog = JSON.parse(await fs.readFile(ukCatalogPath, "utf8"));
const excluded = new Set(["U245100","U916351","do88-kit198Br","SFS32","SFS16","48-24712","do88-kit171Br","do88-kit140Br","TR-850-B-63","SF19-4M","SF15-4M","F25-4M"]);
const do88Products = candidate.currentProducts.filter((product) => product.manufacturerDecision === "unverified_do88_candidate");
const eligible = do88Products.filter((product) => !excluded.has(product.sku));

function sourceSkuKey(value) {
  return String(value ?? "").trim().toUpperCase().replace(/^DO88(?=[A-Z0-9])/, "DO88-");
}
function baseSkuKey(value) { return sourceSkuKey(value).replace(/^DO88-/, ""); }
function htmlText(value) {
  return String(value ?? "").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&times;/gi,"×")
    .replace(/&#8211;/gi,"–").replace(/&#8217;/gi,"’").replace(/&#([0-9]+);/g,(_m,n)=>String.fromCodePoint(Number(n)))
    .replace(/\s+/g," ").trim();
}
function parseWeight(text) {
  const match = text.match(/\bWeight\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|lb|lbs|oz)\b/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const kg = unit === "kg" ? n : unit === "g" ? n / 1000 : unit.startsWith("lb") ? n * 0.45359237 : n * 0.028349523125;
  return Number.isFinite(kg) && kg > 0 ? { raw: match[0], weightKg: Math.round(kg * 1000) / 1000, unit } : null;
}
function parseDimensions(text) {
  const match = text.match(/\bDimensions\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*×\s*([0-9]+(?:[.,][0-9]+)?)\s*×\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m|inches|inch|in)\b/i);
  if (!match) return null;
  const values = match.slice(1,4).map((value)=>Number.parseFloat(value.replace(",", ".")));
  const unit = match[4].toLowerCase();
  const factor = unit === "cm" ? 1 : unit === "mm" ? 0.1 : unit === "m" ? 100 : unit.startsWith("in") ? 2.54 : null;
  if (factor == null || values.some((value)=>!Number.isFinite(value)||value<=0)) return null;
  const dimensionsCm = values.map((value)=>Math.round(value*factor*100)/100);
  const plausible = dimensionsCm.every((value)=>value <= 500);
  return { raw: match[0], unit, lengthCm: dimensionsCm[0], widthCm: dimensionsCm[1], heightCm: dimensionsCm[2], plausibleScale: plausible };
}

const catalogBySku = new Map();
for (const row of ukCatalog.products) {
  const keys = new Set([sourceSkuKey(row.sku), baseSkuKey(row.sku)]);
  for (const key of keys) {
    if (!key) continue;
    const values = catalogBySku.get(key) ?? [];
    values.push(row);
    catalogBySku.set(key, values);
  }
}

const targetsByPermalink = new Map();
const unmatched = [];
const ambiguous = [];
for (const product of eligible) {
  const keys = new Set([sourceSkuKey(product.sku), baseSkuKey(product.sku)]);
  const matches = new Map();
  for (const key of keys) for (const row of catalogBySku.get(key) ?? []) matches.set(`${row.sku}\n${row.permalink}`, row);
  if (!matches.size) { unmatched.push({ sku: product.sku, productId: product.productId }); continue; }
  const rows = [...matches.values()];
  if (rows.length !== 1) { ambiguous.push({ sku: product.sku, productId: product.productId, matches: rows.map(({sku,title,permalink,weightRaw,dimensionsRaw})=>({sku,title,permalink,weightRaw,dimensionsRaw})) }); continue; }
  const row = rows[0];
  const permalink = new URL(row.permalink);
  if (permalink.hostname !== "www.do88.co.uk") throw new Error(`Unexpected retailer URL: ${row.permalink}`);
  const list = targetsByPermalink.get(row.permalink) ?? [];
  list.push({ currentSku: product.sku, productId: product.productId, currentTitle: product.title?.en ?? "", matchedRetailerSku: row.sku, retailerTitle: row.title, weightRaw: row.weightRaw, dimensionsRaw: row.dimensionsRaw });
  targetsByPermalink.set(row.permalink, list);
}

const pages = [...targetsByPermalink.entries()];
const results = new Array(pages.length);
const errors = [];
let next = 0;
const CONCURRENCY = 8;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= pages.length) return;
    const [url, matchedProducts] = pages[index];
    try {
      const response = await fetch(url, { headers: { "User-Agent": "OneCompany-Do88-Shipping-Review/1.0" }, signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rawHtml = await response.text();
      const text = htmlText(rawHtml);
      const pageCodes = [...text.matchAll(/(?:Product Code|Part no\.?|Part number|Reference)\s*:?\s*([A-Z0-9][A-Z0-9-]+)/gi)].map((match)=>match[1]);
      const weight = parseWeight(text);
      const dimensions = parseDimensions(text);
      results[index] = { url, pageCodes, matchedProducts, weight, dimensions, exactPageCodeMatch: matchedProducts.some((product)=>pageCodes.some((code)=>sourceSkuKey(code)===sourceSkuKey(product.matchedRetailerSku)||baseSkuKey(code)===baseSkuKey(product.matchedRetailerSku))) };
    } catch (error) {
      errors.push({ url, currentSkus: matchedProducts.map((item)=>item.currentSku), error: String(error) });
    }
    if ((index + 1) % 50 === 0 || index + 1 === pages.length) {
      const fetched=results.filter(Boolean);
      console.log(`Read ${index+1}/${pages.length}; detail weights with explicit units ${fetched.filter(x=>x.weight).length}; detail dimensions with explicit units ${fetched.filter(x=>x.dimensions).length}; errors ${errors.length}`);
    }
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
}
await Promise.all(Array.from({length:Math.min(CONCURRENCY,pages.length)},worker));
const rows=results.filter(Boolean);
const output={
  source:"do88.co.uk product detail page Additional information",
  retrievedAt:new Date().toISOString(),
  currentCandidateCount:do88Products.length,
  eligibleAfterPendingArchiveSet:eligible.length,
  eligibleWithSingleSKUProductMatch:pages.reduce((sum,[,targets])=>sum+targets.length,0),
  detailPagesFetched:rows.length,
  weightValuesWithExplicitUnits:rows.filter(row=>row.weight).length,
  dimensionsWithExplicitUnits:rows.filter(row=>row.dimensions).length,
  dimensionsWithPlausibleScale:rows.filter(row=>row.dimensions?.plausibleScale).length,
  unmatched,ambiguous,errors,products:rows,
};
const outputResolved=path.resolve(outputPath);
await fs.mkdir(path.dirname(outputResolved),{recursive:true});
await fs.writeFile(outputResolved,`${JSON.stringify(output,null,2)}\n`,"utf8");
console.log(JSON.stringify({output:outputResolved,eligible:output.eligibleAfterPendingArchiveSet,matched:output.eligibleWithSingleSKUProductMatch,detailPages:output.detailPagesFetched,weights:output.weightValuesWithExplicitUnits,dimensions:output.dimensionsWithExplicitUnits,plausibleDimensions:output.dimensionsWithPlausibleScale,unmatched:unmatched.length,ambiguous:ambiguous.length,errors:errors.length},null,2));
