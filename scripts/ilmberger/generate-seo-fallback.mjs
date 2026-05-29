/**
 * Generate seoTitleUa + seoDescriptionUa for Ilmberger products that are
 * missing them. Source: existing titleUa + shortDescUa (both already
 * hand-translated). Skips rows where SEO fields are already populated.
 *
 * Rules:
 *   seoTitleUa:
 *     - if titleUa.length <= 50 → `${titleUa} — Ilmberger Carbon`
 *     - if titleUa.length <= 60 → `${titleUa} — Ilmberger`
 *     - else → titleUa (truncated to 70 on a word boundary if needed)
 *   seoDescriptionUa:
 *     - shortDescUa truncated to 155 chars on a word boundary; appends "…"
 *       if truncated
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/generate-seo-fallback.mjs --dry-run
 *   node --env-file=.env.local scripts/ilmberger/generate-seo-fallback.mjs
 */
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

const MAX_TITLE = 70;
const MAX_DESC = 155;

function truncateOnWord(s, max) {
  if (!s) return s;
  if (s.length <= max) return s;
  // Cut at max, then back up to the last space.
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function buildSeoTitle(titleUa) {
  if (!titleUa) return null;
  const t = titleUa.trim();
  if (t.length <= 50) return `${t} — Ilmberger Carbon`;
  if (t.length <= 60) return `${t} — Ilmberger`;
  return truncateOnWord(t, MAX_TITLE);
}

function buildSeoDescription(shortDescUa) {
  if (!shortDescUa) return null;
  const s = shortDescUa.trim().replace(/\s+/g, " ");
  return truncateOnWord(s, MAX_DESC);
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: {
    id: true,
    sku: true,
    titleUa: true,
    shortDescUa: true,
    seoTitleUa: true,
    seoDescriptionUa: true,
  },
});
console.log(`Scanning ${rows.length} Ilmberger products\n`);

let updated = 0;
let skipped = 0;
const samples = [];
for (const r of rows) {
  const update = {};
  if (!r.seoTitleUa?.trim() && r.titleUa) {
    const generated = buildSeoTitle(r.titleUa);
    if (generated) update.seoTitleUa = generated;
  }
  if (!r.seoDescriptionUa?.trim() && r.shortDescUa) {
    const generated = buildSeoDescription(r.shortDescUa);
    if (generated) update.seoDescriptionUa = generated;
  }

  if (Object.keys(update).length === 0) {
    skipped++;
    continue;
  }

  if (samples.length < 6) samples.push({ sku: r.sku, titleUa: r.titleUa, update });
  updated++;

  if (!DRY) {
    await prisma.shopProduct.update({ where: { id: r.id }, data: update });
  }
}

console.log(
  `${DRY ? "[DRY] " : ""}Updated: ${updated} / ${rows.length}  (skipped existing: ${skipped})\n`
);
console.log("Sample (first 6):");
console.log("════════════════════════════════════════════════════════════════════");
for (const s of samples) {
  console.log(`SKU:        ${s.sku}`);
  console.log(`titleUa:    ${s.titleUa}`);
  if (s.update.seoTitleUa) {
    console.log(`seoTitleUa: ${s.update.seoTitleUa}  [${s.update.seoTitleUa.length} chars]`);
  }
  if (s.update.seoDescriptionUa) {
    console.log(
      `seoDescUa:  ${s.update.seoDescriptionUa}  [${s.update.seoDescriptionUa.length} chars]`
    );
  }
  console.log("────────────────────────────────────────────────────────────────────");
}

await prisma.$disconnect();
