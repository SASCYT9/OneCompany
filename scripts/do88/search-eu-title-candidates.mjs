/**
 * Read-only fallback discovery for catalog SKUs absent from do88's exact-SKU search.
 * Results are candidates only; a different supplier SKU must be reconciled before
 * its price is treated as an exact match.
 *
 * Usage:
 *   node --use-system-ca scripts/do88/search-eu-title-candidates.mjs input.json output.json
 * Input: [{ "sku": "...", "titleEn": "..." }]
 */
import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) throw new Error("Pass input.json and output.json paths");
const targets = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
if (!Array.isArray(targets) || targets.some((row) => !row?.sku || !row?.titleEn)) {
  throw new Error("Input must be an array of rows with sku and titleEn");
}

const BASE = "https://www.do88performance.eu";
const COOKIE = "VALUTA=EUR; SPRAK=EN; MOMS=inkl.";
const CONCURRENCY = 5;
const results = new Array(targets.length);
const errors = [];
let nextIndex = 0;

const STOP_WORDS = new Set([
  "a", "an", "and", "by", "for", "from", "the", "with", "without", "kit", "set",
  "hose", "hoses", "coolant", "radiator", "pressure", "boost", "inlet", "outlet",
  "intake", "black", "blue", "red", "silicone", "do88", "performance", "system",
  "pipe", "pipes", "intercooler", "engine", "car", "cars", "model", "vehicle",
]);
const MAKES = ["Audi", "BMW", "Porsche", "Saab", "Volvo", "Ford", "Mazda", "Opel", "Suzuki", "Seat", "Skoda", "VW", "Volkswagen", "Toyota", "Alpine", "Cupra"];

function normalizeWords(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function queriesFor(title) {
  const queries = [title];
  const words = normalizeWords(title);
  const makeIndex = words.findIndex((word) => MAKES.some((make) => normalizeWords(make).includes(word)));
  if (makeIndex >= 0) {
    const vehicleWords = words.slice(makeIndex, makeIndex + 5).filter((word) => !STOP_WORDS.has(word));
    for (const count of [4, 3, 2]) {
      if (vehicleWords.length >= count) queries.push(vehicleWords.slice(0, count).join(" "));
    }
  }
  return [...new Set(queries)].filter(Boolean);
}

function scoreTitles(source, candidate) {
  const sourceWords = new Set(normalizeWords(source).filter((word) => !STOP_WORDS.has(word)));
  const candidateWords = new Set(normalizeWords(candidate).filter((word) => !STOP_WORDS.has(word)));
  if (!sourceWords.size || !candidateWords.size) return 0;
  let shared = 0;
  for (const word of sourceWords) if (candidateWords.has(word)) shared += 1;
  return Math.round((shared / sourceWords.size) * 1000) / 1000;
}

function cardsFrom(html) {
  const starts = [...html.matchAll(/<div class="PT_Wrapper /g)].map((match) => match.index);
  return starts.map((start, index) => html.slice(start, starts[index + 1] ?? html.length));
}

function parseCard(block) {
  const sku = block.match(/"altnr"\s*:\s*"([^"]+)"/)?.[1]
    ?? block.match(/id="PT_Ikon_Lager_\d+([^"]+)"/)?.[1];
  if (!sku) return null;
  const href = block.match(/<a[^>]+class="info-link[^\"]*"[^>]*href="([^"]+)"/)?.[1]
    ?? block.match(/<a[^>]+href="([^"]+\.html)"/)?.[1];
  const titleEn = block.match(/<a [^>]*title="([^"]+)"/)?.[1]?.trim() ?? "";
  const priceMatch =
    block.match(/<div class="PT_PrisKampanj[^\"]*">([0-9\s.,]+)\s*EUR/) ||
    block.match(/<div class="PrisREA[^\"]*">([0-9\s.,]+)\s*EUR/) ||
    block.match(/<div class="PT_Pris[^\"]*">([0-9\s.,]+)\s*EUR/);
  const priceEur = priceMatch
    ? Number.parseFloat(priceMatch[1].replace(/\s/g, "").replace(",", "."))
    : null;
  return {
    sku,
    titleEn,
    sourceUrl: href ? (href.startsWith("http") ? href : `${BASE}${href}`) : null,
    listingPriceEur: Number.isFinite(priceEur) && priceEur > 0 ? priceEur : null,
    fromPrice: /from\s+[0-9.,]+\s*EUR/i.test(priceMatch?.[0] ?? ""),
  };
}

async function search(term) {
  const url = new URL("/cgi-bin/ibutik/AIR_ibutik.fcgi", BASE);
  url.searchParams.set("funk", "gor_sokning");
  url.searchParams.set("AvanceradSokning", "N");
  url.searchParams.set("Sprak_Suffix", "EN");
  url.searchParams.set("term", term);
  const response = await fetch(url, {
    headers: { "User-Agent": "OneCompany-DO88-Source-Audit/1.0", Cookie: COOKIE },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
  return cardsFrom(await response.text()).map(parseCard).filter(Boolean);
}

async function discover(target) {
  const all = new Map();
  const queries = queriesFor(target.titleEn);
  for (const query of queries) {
    const cards = await search(query);
    for (const card of cards) {
      const score = scoreTitles(target.titleEn, card.titleEn);
      const prev = all.get(card.sku);
      if (!prev || score > prev.titleSimilarity) {
        all.set(card.sku, { ...card, searchedTerm: query, titleSimilarity: score });
      }
    }
    const best = [...all.values()].sort((a, b) => b.titleSimilarity - a.titleSimilarity)[0];
    if (best && best.titleSimilarity >= 0.9) break;
  }
  return {
    requestedSku: target.sku,
    titleEn: target.titleEn,
    candidates: [...all.values()].sort((a, b) => b.titleSimilarity - a.titleSimilarity).slice(0, 10),
  };
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= targets.length) return;
    try { results[index] = await discover(targets[index]); }
    catch (error) { errors.push({ sku: targets[index].sku, error: String(error) }); }
    await new Promise((resolve) => setTimeout(resolve, 200));
    if ((index + 1) % 25 === 0 || index + 1 === targets.length) {
      console.log(`Title searched ${index + 1}/${targets.length}; errors ${errors.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
const output = {
  sourceMode: "EUR / Customer / Incl. VAT",
  searchedAt: new Date().toISOString(),
  requested: targets.length,
  withCandidates: results.filter((row) => row?.candidates.length).length,
  errors,
  results: results.filter(Boolean),
};
const outputResolved = path.resolve(outputPath);
await fs.mkdir(path.dirname(outputResolved), { recursive: true });
await fs.writeFile(outputResolved, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify({ output: outputResolved, requested: output.requested, withCandidates: output.withCandidates, errors: errors.length }));
