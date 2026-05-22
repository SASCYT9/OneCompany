/**
 * Regenerate shortDescUa from bodyHtmlUa for Ilmberger products where
 * the current shortDescUa contains residual English (signal that it was
 * generated from the EN body at import time and never refreshed after
 * the UA body was hand-translated).
 *
 * Strategy:
 *   1. Strip HTML from bodyHtmlUa
 *   2. Take the first ~220 chars, cut on word boundary
 *   3. Compare residual-English score of new vs current; keep current if
 *      new is not strictly better
 *
 * Skips rows where:
 *   - bodyHtmlUa is empty
 *   - current shortDescUa is already cleaner than what we'd generate
 *   - product is one of the 70 newly-translated rows (handled separately;
 *     those have hand-written shortDescUa already)
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/regenerate-shortdesc.mjs --dry-run
 *   node --env-file=.env.local scripts/ilmberger/regenerate-shortdesc.mjs
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

// Skip the 70 newly-translated SKUs — they have hand-written shortDescUa
const NEW_FILES = [
  "tmp/ilmberger-bmw-s1000xr-2024.json",
  "tmp/ilmberger-bmw-m1000xr-2024.json",
  "tmp/ilmberger-bmw-s1000r-2025.json",
  "tmp/ilmberger-bmw-m1000r-2025.json",
];
const newSkus = new Set();
for (const f of NEW_FILES) {
  for (const p of JSON.parse(readFileSync(f, "utf-8"))) newSkus.add(p.sku);
}
console.log(`Skipping ${newSkus.size} newly-translated SKUs (hand-written shortDescUa)\n`);

const KEEP_LATIN = new RegExp(
  "^(BMW|Ducati|Ilmberger|Panigale|Streetfighter|Diavel|XDiavel|Carbon|RR|XR|MY|TÜV|ABE|OEM|ISO|UV|WSBK|EWC|Formula|Prepreg|monoposto|biposto|M1R)$",
  "i"
);

function residualEnglishScore(text) {
  if (!text) return 0;
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const runs = stripped.match(/[A-Za-z][A-Za-z\-']{2,}/g) ?? [];
  let score = 0;
  for (const r of runs) {
    if (KEEP_LATIN.test(r)) continue;
    if (/^[A-Z]{2,5}$/.test(r)) continue;
    if (/^S\d|^M\d/.test(r)) continue;
    if (/^[A-Za-z]{1,2}$/.test(r)) continue;
    score++;
  }
  return score;
}

function stripHtmlToShortDesc(html) {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 150 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: {
    id: true,
    sku: true,
    titleUa: true,
    shortDescUa: true,
    bodyHtmlUa: true,
  },
});
console.log(`Scanning ${rows.length} Ilmberger products`);

let updated = 0;
let skippedClean = 0;
let skippedNew = 0;
let skippedNoBetter = 0;
const samples = [];

for (const r of rows) {
  if (newSkus.has(r.sku)) {
    skippedNew++;
    continue;
  }
  if (!r.bodyHtmlUa?.trim()) continue;

  const currentScore = residualEnglishScore(r.shortDescUa);
  if (currentScore === 0) {
    skippedClean++;
    continue;
  }

  const regenerated = stripHtmlToShortDesc(r.bodyHtmlUa);
  const newScore = residualEnglishScore(regenerated);

  if (newScore >= currentScore) {
    skippedNoBetter++;
    continue;
  }

  if (samples.length < 5) {
    samples.push({
      sku: r.sku,
      titleUa: r.titleUa,
      currentScore,
      newScore,
      current: r.shortDescUa,
      regenerated,
    });
  }
  updated++;

  if (!DRY) {
    await prisma.shopProduct.update({
      where: { id: r.id },
      data: { shortDescUa: regenerated },
    });
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}Results:`);
console.log(`  Updated:            ${updated}`);
console.log(`  Skipped (already clean):  ${skippedClean}`);
console.log(`  Skipped (new SKUs):       ${skippedNew}`);
console.log(`  Skipped (no improvement): ${skippedNoBetter}`);

console.log("\nSample (first 5):");
console.log("════════════════════════════════════════════════════════════════════");
for (const s of samples) {
  console.log(`SKU:           ${s.sku}`);
  console.log(`titleUa:       ${s.titleUa}`);
  console.log(`current  [score=${s.currentScore}]: ${s.current}`);
  console.log(`regenerated [score=${s.newScore}]: ${s.regenerated}`);
  console.log("────────────────────────────────────────────────────────────────────");
}

await prisma.$disconnect();
