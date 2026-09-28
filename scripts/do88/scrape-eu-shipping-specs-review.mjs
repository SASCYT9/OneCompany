#!/usr/bin/env node

/**
 * Read-only exact-detail-page audit of do88 EU technical and shipping specs.
 * Product/core dimensions are kept separate from explicit package dimensions.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-eu-shipping-specs-review.mjs input.json output.json
 * Input: [{ "sku": "...", "storeSku": "...", "sourceUrl": "https://www.do88performance.eu/en/artiklar/...html" }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");
const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((row) => !row?.sku || !row?.sourceUrl)) {
  throw new Error("Input must be an array with sku and sourceUrl per row");
}

const COOKIE = "VALUTA=EUR; SPRAK=EN; MOMS=inkl.";
const CONCURRENCY = 6;
const results = new Array(targets.length);
const errors = [];
let next = 0;

function decodeText(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#160;|&nbsp;/gi, " ").replace(/&#8211;/gi, "–").replace(/&#8217;/gi, "’")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ").trim();
}

function htmlFragmentText(value) {
  return decodeText(String(value ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));
}

function parseRows(html) {
  const blockPattern = /<(div|td|span)[^>]*class=["'][^"']*TeknSpec_Rad([12])_[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  const cells = [...html.matchAll(blockPattern)].map((match) => ({
    side: Number(match[2]),
    text: htmlFragmentText(match[3]).replace(/\s*:\s*$/, "").trim(),
  })).filter((cell) => cell.text);
  const rows = [];
  for (let i = 0; i + 1 < cells.length; i += 1) {
    if (cells[i].side === cells[i + 1].side) {
      // Each side contains label/value pairs in adjacent table cells.
      rows.push({ label: cells[i].text, value: cells[i + 1].text });
      i += 1;
    }
  }
  return rows;
}

function dimensionInMm(value) {
  const match = String(value ?? "").match(/([0-9.,]+)\s*[×x]\s*([0-9.,]+)\s*[×x]\s*([0-9.,]+)\s*(mm|cm|m|inches|inch|in)\b/i);
  if (!match) return null;
  const nums = match.slice(1, 4).map((raw) => Number.parseFloat(raw.replace(",", ".")));
  const unit = match[4].toLowerCase();
  const factor = unit === "mm" ? 1 : unit === "cm" ? 10 : unit === "m" ? 1000 : unit.startsWith("in") ? 25.4 : null;
  if (factor == null || nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { lengthMm: Math.round(nums[0] * factor * 100) / 100, widthMm: Math.round(nums[1] * factor * 100) / 100, heightMm: Math.round(nums[2] * factor * 100) / 100, raw: match[0] };
}

function explicitWeightKg(value) {
  const match = String(value ?? "").match(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|lb|lbs|oz)\b/i);
  if (!match) return null;
  const n = Number.parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const kg = unit === "kg" ? n : unit === "g" ? n / 1000 : unit.startsWith("lb") ? n * 0.45359237 : n * 0.028349523125;
  return Number.isFinite(kg) && kg > 0 ? { weightKg: Math.round(kg * 1000) / 1000, raw: match[0], unit } : null;
}

function parsePage(html, target) {
  const pageSku = html.match(/<input[^>]+name="altnr"[^>]+value="([^"]+)"/i)?.[1] ?? null;
  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const jsonLdProducts = [];
  for (const block of jsonLdBlocks) {
    try {
      const value = JSON.parse(block[1]);
      const walk = (item) => {
        if (Array.isArray(item)) item.forEach(walk);
        else if (item && typeof item === "object") {
          const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
          if (type.includes("Product")) jsonLdProducts.push(item);
          Object.values(item).filter((child) => child && typeof child === "object").forEach(walk);
        }
      };
      walk(value);
    } catch { /* ignore non-JSON script blocks */ }
  }
  const jsonProduct = jsonLdProducts.find((item) => item.sku || item.mpn) ?? jsonLdProducts[0] ?? null;
  const jsonLdSku = jsonProduct?.sku ?? jsonProduct?.mpn ?? null;
  const specifications = parseRows(html);
  const totalSizeRows = specifications.filter((row) => /^(?:total|overall|external|package|shipping)\s*(?:size|dimensions?)$/i.test(row.label));
  const coreSizeRows = specifications.filter((row) => /^(?:core|intercooler core)\s*(?:size|dimensions?)$/i.test(row.label));
  const productWeightRows = specifications.filter((row) => /^(?:product\s+)?weight$/i.test(row.label));
  const packageWeightRows = specifications.filter((row) => /^(?:package|shipping|packed)\s+weight$/i.test(row.label));
  const packageDimensionRows = specifications.filter((row) => /^(?:package|shipping|packed)\s+dimensions?$/i.test(row.label));
  const text = htmlFragmentText(html);
  return {
    requestedSku: target.sku,
    storeSku: target.storeSku ?? target.sku,
    sourceUrl: target.sourceUrl,
    pageSku,
    jsonLdSku,
    exactSkuMatch: [pageSku, jsonLdSku].some((sku) => sku && sku.toLowerCase() === String(target.sku).toLowerCase()),
    sourceTitle: htmlFragmentText(jsonProduct?.name ?? ""),
    specifications,
    productTotalDimensions: totalSizeRows.map((row) => ({ label: row.label, value: row.value, parsedMm: dimensionInMm(row.value) })),
    productCoreDimensions: coreSizeRows.map((row) => ({ label: row.label, value: row.value, parsedMm: dimensionInMm(row.value) })),
    productWeight: productWeightRows.map((row) => ({ label: row.label, value: row.value, parsed: explicitWeightKg(row.value) })),
    explicitPackageWeight: packageWeightRows.map((row) => ({ label: row.label, value: row.value, parsed: explicitWeightKg(row.value) })),
    explicitPackageDimensions: packageDimensionRows.map((row) => ({ label: row.label, value: row.value, parsedMm: dimensionInMm(row.value) })),
    jsonLdWeight: explicitWeightKg(String(jsonProduct?.weight?.value ?? jsonProduct?.weight ?? "")),
    pageHasShippingSpecText: /shipping\s+(?:weight|dimensions?)/i.test(text),
    sourceMode: "English Europe; official product technical details; weight/dimension fields remain unset unless packaging labels are explicit",
  };
}

async function fetchTarget(target) {
  const url = new URL(target.sourceUrl);
  if (url.hostname !== "www.do88performance.eu" || !url.pathname.startsWith("/en/artiklar/") || !url.pathname.endsWith(".html")) {
    throw new Error(`Refusing URL outside direct do88 English-Europe product page: ${target.sourceUrl}`);
  }
  const response = await fetch(url, {
    headers: { "User-Agent": "OneCompany-DO88-Shipping-Spec-Audit/1.0", Cookie: COOKIE },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parsePage(await response.text(), target);
}

async function worker() {
  while (true) {
    const index = next++;
    if (index >= targets.length) return;
    try { results[index] = await fetchTarget(targets[index]); }
    catch (error) { errors.push({ sku: targets[index].sku, sourceUrl: targets[index].sourceUrl, error: String(error) }); }
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      const fetched = results.filter(Boolean);
      console.log(`Read ${index + 1}/${targets.length}; exact SKU ${fetched.filter((r) => r.exactSkuMatch).length}; product size specs ${fetched.filter((r) => r.productTotalDimensions.some((x) => x.parsedMm)).length}; package weight ${fetched.filter((r) => r.explicitPackageWeight.some((x) => x.parsed)).length}; package dimensions ${fetched.filter((r) => r.explicitPackageDimensions.some((x) => x.parsedMm)).length}; errors ${errors.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const products = results.filter(Boolean);
const output = {
  source: "do88performance.eu English Europe direct detail pages",
  retrievedAt: new Date().toISOString(),
  requested: targets.length,
  fetched: products.length,
  exactSkuMatches: products.filter((item) => item.exactSkuMatch).length,
  productsWithTechnicalDimensions: products.filter((item) => item.productTotalDimensions.some((row) => row.parsedMm) || item.productCoreDimensions.some((row) => row.parsedMm)).length,
  productsWithExplicitPackageWeight: products.filter((item) => item.explicitPackageWeight.some((row) => row.parsed)).length,
  productsWithExplicitPackageDimensions: products.filter((item) => item.explicitPackageDimensions.some((row) => row.parsedMm)).length,
  errors,
  products,
};
const resolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolved), { recursive: true });
await fs.writeFile(resolved, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: resolved, requested: output.requested, fetched: output.fetched, exactSkuMatches: output.exactSkuMatches, productsWithTechnicalDimensions: output.productsWithTechnicalDimensions, productsWithExplicitPackageWeight: output.productsWithExplicitPackageWeight, productsWithExplicitPackageDimensions: output.productsWithExplicitPackageDimensions, errors: errors.length }, null, 2));
