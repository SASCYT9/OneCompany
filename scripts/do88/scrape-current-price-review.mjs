/**
 * Refresh prices for an explicit, reviewed list of current Do88 SKU candidates.
 * Read only. The source session is fixed to EUR / Consumer / Incl. VAT.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/scrape-current-price-review.mjs input.json output.json
 * Input: [{ "sku": "...", "sourceUrl": "https://www.do88performance.eu/en/artiklar/...html" }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");

const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((row) => !row?.sku || !row?.sourceUrl)) {
  throw new Error("Input must be an array of rows with sku and sourceUrl");
}
const seen = new Set();
for (const target of targets) {
  const url = new URL(target.sourceUrl);
  if (url.hostname !== "www.do88performance.eu" || !url.pathname.startsWith("/en/artiklar/")) {
    throw new Error(`Refusing non-Do88 product URL: ${target.sourceUrl}`);
  }
  if (seen.has(target.sku)) throw new Error(`Duplicate input SKU: ${target.sku}`);
  seen.add(target.sku);
}

const SOURCE_RETRIEVED_AT = new Date().toISOString();
const BASE_URL = "https://www.do88performance.eu";
const CONCURRENCY = 5;
const products = [];
const errors = [];
let nextIndex = 0;

function parseProduct(html, target) {
  const skuMatch = html.match(/<input[^>]+name="altnr"[^>]+value="([^"]+)"/);
  const pageSku = skuMatch?.[1];
  if (!pageSku) {
    const wrapperRe = /<div class="PT_Wrapper[\s\S]*?(?=<div class="PT_Wrapper |<div class="PT_Wrapper_All|<div class="row paging|<div id="result_artiklar)/g;
    const blocks = html.match(wrapperRe) ?? [];
    for (const block of blocks) {
      const cardSku = block.match(/"altnr"\s*:\s*"([^"]+)"/)?.[1];
      if (cardSku?.toLowerCase() !== target.sku.toLowerCase()) continue;
      const cardPrice =
        block.match(/<div class="PT_PrisKampanj[^"]*">([0-9\s.,]+)\s*EUR/) ||
        block.match(/<div class="PrisREA[^"]*">([0-9\s.,]+)\s*EUR/) ||
        block.match(/<div class="PT_Pris[^"]*">([0-9\s.,]+)\s*EUR/);
      if (!cardPrice || /from\s+[0-9.,]+\s*EUR/i.test(cardPrice[0])) {
        throw new Error("Exact SKU has no single visible customer price in its listing card");
      }
      const priceEur = Number.parseFloat(cardPrice[1].replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(priceEur) || priceEur <= 0) throw new Error("Invalid listing EUR price");
      const titleEn = block.match(/<a [^>]*title="([^"]+)"/)?.[1] ?? "";
      return {
        requestedSku: target.sku,
        pageSku: cardSku,
        titleEn,
        priceEur,
        sourceUrl: target.sourceUrl,
        sourceRetrievedAt: SOURCE_RETRIEVED_AT,
        sourceMode: "EUR / Customer / Incl. VAT",
        source: "listing",
      };
    }
    throw new Error("Product SKU is missing and no matching listing card was found");
  }
  if (pageSku.toLowerCase() !== target.sku.toLowerCase()) {
    throw new Error(`Detail page SKU mismatch: expected ${target.sku}, got ${pageSku}`);
  }

  const priceMatch =
    html.match(/<span class="PrisREA[^"]*">([0-9\s.,]+)/) ||
    html.match(/<span class="PrisBOLD[^"]*">([0-9\s.,]+)/);
  if (!priceMatch) throw new Error("Visible Customer / Incl. VAT price is missing");
  const priceEur = Number.parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(priceEur) || priceEur <= 0) throw new Error("Invalid source EUR price");

  const imagesMatch = html.match(/json_images\s*=\s*(\{[\s\S]*?\})\s*;/);
  let variantImages = {};
  if (imagesMatch) {
    try {
      const imageData = JSON.parse(imagesMatch[1].replace(/,\s*([}\]])/g, "$1"));
      variantImages = Object.fromEntries(
        Object.entries(imageData.articles ?? {}).flatMap(([sku, item]) => {
          if (!item || typeof item !== "object") return [];
          const values = [item.large, item.normal, ...(Array.isArray(item.extra_images) ? item.extra_images : [])]
            .filter((value) => typeof value === "string" && value.length > 0)
            .map((value) => new URL(value, BASE_URL).toString());
          return values.length ? [[sku, [...new Set(values)]]] : [];
        })
      );
    } catch {
      // Keep the price record even when the supplier's inline image map changes shape.
    }
  }

  const ld = html.match(/"@type"\s*:\s*"Product"\s*,\s*"name"\s*:\s*"([^"]+)"/);
  const titleEn = ld?.[1]?.replace(/&#8221;/g, '"').replace(/&#160;/g, " ") ?? "";
  return {
    requestedSku: target.sku,
    pageSku,
    titleEn,
    priceEur,
    sourceUrl: target.sourceUrl,
    sourceRetrievedAt: SOURCE_RETRIEVED_AT,
    sourceMode: "EUR / Customer / Incl. VAT",
    source: "detail",
    variantImages,
  };
}

async function fetchOne(target) {
  const response = await fetch(target.sourceUrl, {
    headers: {
      "User-Agent": "OneCompany-DO88-PriceReview/1.0",
      Cookie: "VALUTA=EUR; SPRAK=EN; MOMS=inkl.",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseProduct(await response.text(), target);
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= targets.length) return;
    const target = targets[index];
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        products[index] = await fetchOne(target);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    if (lastError) errors.push({ sku: target.sku, sourceUrl: target.sourceUrl, error: String(lastError) });
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      console.log(`Fetched ${index + 1}/${targets.length}; errors ${errors.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const result = {
  sourceMode: "EUR / Customer / Incl. VAT",
  markupPct: 10,
  retrievedAt: SOURCE_RETRIEVED_AT,
  requested: targets.length,
  succeeded: products.filter(Boolean).length,
  failed: errors.length,
  products: products.filter(Boolean),
  errors,
};
const resolvedOutput = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify({ output: resolvedOutput, requested: result.requested, succeeded: result.succeeded, failed: result.failed }));
