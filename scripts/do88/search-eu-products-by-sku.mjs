/**
 * Read-only exact-SKU discovery through do88's English Europe site search.
 * This finds product detail URLs even when a SKU is absent from its old
 * category/listing URL mapping.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/search-eu-products-by-sku.mjs input.json output.json
 * Input: [{ "sku": "...", "titleEn": "..." }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");

const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((row) => !row?.sku)) {
  throw new Error("Input must be an array of rows with an SKU");
}

const BASE = "https://www.do88performance.eu";
const COOKIE = "VALUTA=EUR; SPRAK=EN; MOMS=inkl.";
const CONCURRENCY = 5;
const results = new Array(targets.length);
const errors = [];
let nextIndex = 0;

function blocksFrom(html) {
  const starts = [...html.matchAll(/<div class="PT_Wrapper /g)].map((match) => match.index);
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

function parseCard(block, target) {
  // Available cards carry the buy-button's altnr; discontinued/out-of-stock
  // cards may omit it but still expose their exact SKU in the stock-icon id.
  const sku = block.match(/"altnr"\s*:\s*"([^"]+)"/)?.[1]
    ?? block.match(/id="PT_Ikon_Lager_\d+([^"]+)"/)?.[1];
  if (sku?.toLowerCase() !== target.sku.toLowerCase()) return null;

  const href = block.match(/<a[^>]+class="info-link[^>]+href="([^"]+)"/)?.[1]
    ?? block.match(/<a[^>]+href="([^"]+\.html)"/)?.[1];
  if (!href) throw new Error("Exact SKU search result has no product detail link");
  const sourceUrl = href.startsWith("http") ? href : `${BASE}${href}`;
  const parsedUrl = new URL(sourceUrl);
  if (parsedUrl.hostname !== "www.do88performance.eu" || !parsedUrl.pathname.startsWith("/en/artiklar/")) {
    throw new Error(`Unexpected product result URL: ${sourceUrl}`);
  }

  const titleEn = block.match(/<a [^>]*title="([^"]+)"/)?.[1]?.trim() ?? "";
  const priceMatch =
    block.match(/<div class="PT_PrisKampanj[^\"]*">([0-9\s.,]+)\s*EUR/) ||
    block.match(/<div class="PrisREA[^\"]*">([0-9\s.,]+)\s*EUR/) ||
    block.match(/<div class="PT_Pris[^\"]*">([0-9\s.,]+)\s*EUR/);
  const priceText = priceMatch?.[0] ?? "";
  const priceEur = priceMatch
    ? Number.parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
    : null;
  const fromPrice = /from\s+[0-9.,]+\s*EUR/i.test(priceText);

  return {
    requestedSku: target.sku,
    pageSku: sku,
    titleEn,
    sourceUrl,
    listingPriceEur: Number.isFinite(priceEur) && priceEur > 0 ? priceEur : null,
    listingHasSinglePrice: !fromPrice && Number.isFinite(priceEur) && priceEur > 0,
    sourceMode: "EUR / Customer / Incl. VAT",
  };
}

async function fetchDetailPrice(card, target) {
  if (card.listingHasSinglePrice) {
    return { ...card, priceEur: card.listingPriceEur, priceSource: "exact_sku_search_listing" };
  }

  const response = await fetch(card.sourceUrl, {
    headers: { "User-Agent": "OneCompany-DO88-Source-Audit/1.0", Cookie: COOKIE },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Product detail HTTP ${response.status}`);
  const html = await response.text();
  const pageSku = html.match(/<input[^>]+name="altnr"[^>]+value="([^"]+)"/)?.[1];
  if (pageSku?.toLowerCase() !== target.sku.toLowerCase()) {
    throw new Error(`Product detail SKU mismatch: expected ${target.sku}, got ${pageSku ?? "<missing>"}`);
  }
  const priceMatch =
    html.match(/<span class="PrisREA[^\"]*">([0-9\s.,]+)/) ||
    html.match(/<span class="PrisBOLD[^\"]*">([0-9\s.,]+)/);
  const priceEur = priceMatch
    ? Number.parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
    : null;
  if (!Number.isFinite(priceEur) || priceEur <= 0) {
    return { ...card, pageSku, priceEur: null, priceSource: "detail_price_not_visible" };
  }
  return { ...card, pageSku, priceEur, priceSource: "exact_sku_detail_page" };
}

async function searchSku(sku) {
  const url = new URL("/cgi-bin/ibutik/AIR_ibutik.fcgi", BASE);
  url.searchParams.set("funk", "gor_sokning");
  url.searchParams.set("AvanceradSokning", "N");
  url.searchParams.set("Sprak_Suffix", "EN");
  url.searchParams.set("term", sku);
  const response = await fetch(url, {
    headers: { "User-Agent": "OneCompany-DO88-Source-Audit/1.0", Cookie: COOKIE },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
  const html = await response.text();
  const target = { sku };
  const matches = blocksFrom(html).map((block) => parseCard(block, target)).filter(Boolean);
  if (matches.length > 1) throw new Error(`Multiple exact-SKU search results (${matches.length})`);
  if (!matches[0]) return null;
  return fetchDetailPrice(matches[0], target);
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= targets.length) return;
    const target = targets[index];
    try {
      results[index] = await searchSku(target.sku);
    } catch (error) {
      errors.push({ sku: target.sku, error: String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
      const found = results.filter(Boolean).length;
      console.log(`Searched ${index + 1}/${targets.length}; exact SKU pages found ${found}; errors ${errors.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const output = {
  sourceMode: "EUR / Customer / Incl. VAT",
  searchedAt: new Date().toISOString(),
  requested: targets.length,
  exactSkuPagesFound: results.filter(Boolean).length,
  noExactSkuResult: results.filter((item) => !item).length,
  errors,
  products: results.filter(Boolean),
  notFound: targets.filter((_, index) => !results[index] && !errors.some((error) => error.sku === targets[index].sku)),
};
const resolvedOutput = path.resolve(outputPath);
await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify({ output: resolvedOutput, requested: output.requested, exactSkuPagesFound: output.exactSkuPagesFound, noExactSkuResult: output.noExactSkuResult, errors: errors.length }));
