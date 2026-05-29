/**
 * Audit ALL UA-localized fields of the 90 newly-imported Ilmberger SKUs
 * (S/M 1000 XR + S/M 1000 R from the 4 source JSONs):
 *   - titleUa
 *   - shortDescUa
 *   - bodyHtmlUa
 *   - seoTitleUa
 *   - seoDescriptionUa
 *   - categoryUa
 *
 * Surfaces:
 *   1. Empty / null fields
 *   2. Residual English (Latin character runs not in safelist)
 *   3. categoryUa != categoryEn drift checks
 *   4. shortDescUa starts with stripped EN (signal that auto-translate hit it)
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/audit-all-ua-fields.mjs
 *   node --env-file=.env.local scripts/ilmberger/audit-all-ua-fields.mjs --verbose
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");

const FILES = [
  "tmp/ilmberger-bmw-s1000xr-2024.json",
  "tmp/ilmberger-bmw-m1000xr-2024.json",
  "tmp/ilmberger-bmw-s1000r-2025.json",
  "tmp/ilmberger-bmw-m1000r-2025.json",
];
const skuSet = new Set();
for (const f of FILES) {
  for (const p of JSON.parse(readFileSync(f, "utf-8"))) skuSet.add(p.sku);
}
const slugs = [...skuSet].map((sku) => "ilmberger-" + sku.toLowerCase().replace(/[.\s]+/g, "-"));

const KEEP_LATIN = new RegExp(
  "^(" +
    [
      "BMW",
      "Ducati",
      "Ilmberger",
      "Panigale",
      "Streetfighter",
      "Diavel",
      "XDiavel",
      "Carbon",
      "RR",
      "XR",
      "MY",
      "TÜV",
      "ABE",
      "OEM",
      "ISO",
      "UV",
      "WSBK",
      "EWC",
      "Formula",
      "Prepreg",
      "monoposto",
      "biposto",
      "M1R",
      "Streetfighter",
    ].join("|") +
    ")$",
  "i"
);

function residualEnglishScore(text) {
  if (!text) return { score: 0, samples: [] };
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const runs = stripped.match(/[A-Za-z][A-Za-z\-']{2,}/g) ?? [];
  let score = 0;
  const samples = [];
  for (const r of runs) {
    if (KEEP_LATIN.test(r)) continue;
    if (/^[A-Z]{2,5}$/.test(r)) continue; // short ALLCAPS = abbreviation
    if (/^S\d|^M\d/.test(r)) continue; // chassis codes like S119S, M123N
    if (/^[A-Za-z]{1,2}$/.test(r)) continue; // 1-2 char tokens
    score++;
    if (samples.length < 6) samples.push(r);
  }
  return { score, samples };
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { slug: { in: slugs } },
  select: {
    sku: true,
    slug: true,
    titleEn: true,
    titleUa: true,
    shortDescEn: true,
    shortDescUa: true,
    bodyHtmlEn: true,
    bodyHtmlUa: true,
    seoTitleUa: true,
    seoDescriptionUa: true,
    categoryEn: true,
    categoryUa: true,
  },
});
console.log(`Auditing ${rows.length}/${skuSet.size} newly-imported SKUs\n`);

const FIELDS = [
  "titleUa",
  "shortDescUa",
  "bodyHtmlUa",
  "seoTitleUa",
  "seoDescriptionUa",
  "categoryUa",
];

const issues = {
  empty: {
    titleUa: [],
    shortDescUa: [],
    bodyHtmlUa: [],
    seoTitleUa: [],
    seoDescriptionUa: [],
    categoryUa: [],
  },
  residualEn: {
    titleUa: [],
    shortDescUa: [],
    bodyHtmlUa: [],
    seoTitleUa: [],
    seoDescriptionUa: [],
    categoryUa: [],
  },
  categoryMismatch: [],
  shortDescIsEnglish: [],
};

for (const r of rows) {
  // 1. Empty fields
  for (const f of FIELDS) {
    if (!r[f] || r[f].trim?.() === "") issues.empty[f].push(r);
  }

  // 2. Residual English per field
  for (const f of FIELDS) {
    if (!r[f]) continue;
    const { score, samples } = residualEnglishScore(r[f]);
    // titleUa/seoTitleUa/categoryUa — strict (>= 1)
    // shortDescUa/seoDescriptionUa — strict-ish (>= 2)
    // bodyHtmlUa — already polished, anything >= 10 is suspect
    const threshold =
      f === "bodyHtmlUa" ? 10 : f === "shortDescUa" || f === "seoDescriptionUa" ? 2 : 1;
    if (score >= threshold) issues.residualEn[f].push({ sku: r.sku, score, samples, value: r[f] });
  }

  // 3. categoryUa drift — should equal categoryEn for BMW models (we use same string)
  if (r.categoryUa && r.categoryEn && r.categoryUa !== r.categoryEn) {
    issues.categoryMismatch.push({
      sku: r.sku,
      categoryEn: r.categoryEn,
      categoryUa: r.categoryUa,
    });
  }

  // 4. shortDescUa starts with English (suggests auto-translate residue)
  if (r.shortDescUa && r.shortDescEn) {
    const ua = r.shortDescUa.slice(0, 80);
    const en = r.shortDescEn.slice(0, 80);
    if (ua === en) issues.shortDescIsEnglish.push(r.sku);
  }
}

// Report
function reportEmptyOrMissing() {
  for (const f of FIELDS) {
    const list = issues.empty[f];
    if (list.length === 0) continue;
    console.log(`⚠  Empty ${f}: ${list.length} rows`);
    for (const r of list.slice(0, 5)) console.log(`    ${r.sku}`);
    if (list.length > 5) console.log(`    ... +${list.length - 5} more`);
  }
}

function reportResidualEn() {
  for (const f of FIELDS) {
    const list = issues.residualEn[f];
    if (list.length === 0) continue;
    console.log(`\n⚠  Residual English in ${f}: ${list.length} rows`);
    const top = [...list].sort((a, b) => b.score - a.score).slice(0, VERBOSE ? 50 : 10);
    for (const item of top) {
      console.log(`    [score=${item.score}] ${item.sku}  samples: ${item.samples.join(", ")}`);
      if (VERBOSE && (f === "titleUa" || f === "categoryUa" || f === "seoTitleUa")) {
        console.log(`      → "${item.value}"`);
      }
    }
    if (list.length > 10 && !VERBOSE)
      console.log(`    ... +${list.length - 10} more (re-run --verbose to see)`);
  }
}

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("EMPTY / NULL FIELDS");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
reportEmptyOrMissing();
const allEmpty = Object.values(issues.empty).every((v) => v.length === 0);
if (allEmpty) console.log("✓ All UA fields populated for all 90 SKUs.");

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("RESIDUAL ENGLISH (per field)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const allResidualClean = Object.values(issues.residualEn).every((v) => v.length === 0);
reportResidualEn();
if (allResidualClean) console.log("✓ No residual English detected above thresholds.");

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CATEGORY UA/EN DRIFT");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (issues.categoryMismatch.length === 0)
  console.log("✓ categoryUa matches categoryEn for all 90.");
else {
  console.log(`⚠  Drift in ${issues.categoryMismatch.length} rows`);
  for (const m of issues.categoryMismatch.slice(0, 20))
    console.log(`    ${m.sku}\n      EN: ${m.categoryEn}\n      UA: ${m.categoryUa}`);
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("shortDescUa == shortDescEn (untranslated)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (issues.shortDescIsEnglish.length === 0)
  console.log("✓ shortDescUa differs from shortDescEn for all 90.");
else
  console.log(
    `⚠  ${issues.shortDescIsEnglish.length} rows have identical UA == EN short desc:\n    ${issues.shortDescIsEnglish.join(", ")}`
  );

await prisma.$disconnect();
