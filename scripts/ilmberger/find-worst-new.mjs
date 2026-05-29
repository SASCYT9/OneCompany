/**
 * Find Ilmberger products from the 4 new BMW collections that still have
 * the most residual English in their UA fields. Prints the top N worst-quality
 * rows with full EN body — copy/paste source for manual UA translation.
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/find-worst-new.mjs
 *   node --env-file=.env.local scripts/ilmberger/find-worst-new.mjs --limit 5
 *   node --env-file=.env.local scripts/ilmberger/find-worst-new.mjs --skip 5 --limit 5
 *   node --env-file=.env.local scripts/ilmberger/find-worst-new.mjs --sku CG.TAO.001
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const limitIdx = argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : 5;
const skipIdx = argv.indexOf("--skip");
const SKIP = skipIdx >= 0 ? parseInt(argv[skipIdx + 1], 10) : 0;
const skuIdx = argv.indexOf("--sku");
const SKU_FILTER = skuIdx >= 0 ? argv[skuIdx + 1] : null;

// Collect SKUs from the 4 source JSONs
const FILES = [
  "tmp/ilmberger-bmw-s1000xr-2024.json",
  "tmp/ilmberger-bmw-m1000xr-2024.json",
  "tmp/ilmberger-bmw-s1000r-2025.json",
  "tmp/ilmberger-bmw-m1000r-2025.json",
];
const skuSet = new Set();
for (const f of FILES) {
  const arr = JSON.parse(readFileSync(f, "utf-8"));
  for (const p of arr) skuSet.add(p.sku);
}
const skus = [...skuSet];

function skuToSlug(sku) {
  return "ilmberger-" + sku.toLowerCase().replace(/[.\s]+/g, "-");
}

// Score = count of Latin character runs >=3 chars in UA fields,
// minus tolerance for brand names (BMW, Ducati, Ilmberger, etc.) and SKU codes.
const KEEP_LATIN =
  /^(BMW|Ducati|Ilmberger|Panigale|Streetfighter|Diavel|XDiavel|RR|XR|MY|TÜV|ABE|OEM|ISO|UV|S|M|G|N|R|XR)$/i;
function residualEnglishScore(html) {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const runs = text.match(/[A-Za-z][A-Za-z\-']{2,}/g) ?? [];
  let score = 0;
  const samples = [];
  for (const r of runs) {
    if (KEEP_LATIN.test(r)) continue;
    if (/^[A-Z]{2,5}$/.test(r)) continue; // ALLCAPS short = abbreviation
    score++;
    if (samples.length < 10) samples.push(r);
  }
  return { score, samples };
}

const prisma = new PrismaClient();
const slugs = skus.map(skuToSlug);
const rows = await prisma.shopProduct.findMany({
  where: { slug: { in: slugs } },
  select: {
    id: true,
    slug: true,
    sku: true,
    titleEn: true,
    titleUa: true,
    bodyHtmlEn: true,
    bodyHtmlUa: true,
    shortDescEn: true,
    shortDescUa: true,
    categoryEn: true,
    categoryUa: true,
    createdAt: true,
  },
});

const scored = rows.map((r) => {
  const t = residualEnglishScore(r.titleUa);
  const b = residualEnglishScore(r.bodyHtmlUa);
  const s = residualEnglishScore(r.shortDescUa);
  return {
    ...r,
    _titleScore: t.score,
    _bodyScore: b.score,
    _shortScore: s.score,
    _samples: [...t.samples, ...b.samples].slice(0, 15),
  };
});

// Filter out near-complete translations (already hand-translated rows that
// score 0–10 from valid Latin tokens like "OEM", "UV", "Carbon", "Formula").
const MIN_BODY_SCORE = 20;
const needsWork = scored.filter((r) => r._bodyScore >= MIN_BODY_SCORE);
console.log(
  `Filtered: ${needsWork.length}/${scored.length} rows still need work (bodyScore >= ${MIN_BODY_SCORE})`
);
scored.length = 0;
scored.push(...needsWork);

// Sort: title leftovers count first (titles are visible), then body
scored.sort((a, b) => b._titleScore - a._titleScore || b._bodyScore - a._bodyScore);

console.log(`\nFound ${rows.length}/${skus.length} of new SKUs in DB`);
console.log(`Showing rows [${SKIP}..${SKIP + LIMIT - 1}] of worst-quality UA\n`);

let shown = 0;
for (let i = SKIP; i < scored.length && shown < LIMIT; i++) {
  const r = scored[i];
  if (SKU_FILTER && !r.sku.includes(SKU_FILTER)) continue;
  shown++;
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`#${i + 1}  ${r.sku}   (titleScore=${r._titleScore}, bodyScore=${r._bodyScore})`);
  console.log(`slug:       ${r.slug}`);
  console.log(`categoryEn: ${r.categoryEn}`);
  console.log(`categoryUa: ${r.categoryUa}`);
  console.log(`titleEn:    ${r.titleEn}`);
  console.log(`titleUa:    ${r.titleUa}`);
  console.log(`shortEn:    ${r.shortDescEn}`);
  console.log(`shortUa:    ${r.shortDescUa}`);
  console.log(`\n─── bodyHtmlEn ───`);
  console.log(r.bodyHtmlEn);
  console.log(`\n─── bodyHtmlUa (current) ───`);
  console.log(r.bodyHtmlUa);
  console.log(`\nResidual EN samples: ${r._samples.join(", ")}`);
  console.log();
}

await prisma.$disconnect();
