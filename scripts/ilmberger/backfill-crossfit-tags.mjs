/**
 * Backfill missing cross-fit bike-model tags. Some products have titles like
 *   "BMW S 1000 RR from MY 2019 / M 1000 RR / S 1000 R / M 1000 R"
 * which fit 4 bike models, but the import script only assigned the first
 * two tags (because the !RR / !XR guard on the simple regex blocks the
 * second pass). This walks every Ilmberger product, derives the full set
 * of bike-model tags from the title, and adds any that are missing.
 *
 * Run:
 *   node --env-file=.env.local scripts/ilmberger/backfill-crossfit-tags.mjs --dry-run
 *   node --env-file=.env.local scripts/ilmberger/backfill-crossfit-tags.mjs
 */
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");

const BMW_MODELS = ["S 1000 RR", "M 1000 RR", "S 1000 XR", "M 1000 XR", "S 1000 R", "M 1000 R"];

function deriveBmwModels(titleEn) {
  if (!titleEn) return [];
  const t = titleEn.toLowerCase();
  const noSpace = t.replace(/\s+/g, "");
  const out = new Set();

  // High-specificity tags first.
  if (noSpace.includes("m1000xr")) out.add("M 1000 XR");
  if (noSpace.includes("s1000xr")) out.add("S 1000 XR");
  if (noSpace.includes("m1000rr")) out.add("M 1000 RR");
  if (noSpace.includes("s1000rr")) out.add("S 1000 RR");

  // For the "R" variants we need to look for "1000 r" tokens that are NOT
  // followed by another letter (so we don't capture the "r" in "rr" or "xr").
  // Title may list them explicitly via "/", e.g. "RR / M 1000 R".
  // Use a token-boundary regex: "m 1000 r" followed by non-letter or end.
  if (/m\s*1000\s*r(?![a-z])/i.test(titleEn)) out.add("M 1000 R");
  if (/s\s*1000\s*r(?![a-z])/i.test(titleEn)) out.add("S 1000 R");

  return [...out];
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: { id: true, sku: true, slug: true, titleEn: true, tags: true },
});
console.log(`Scanning ${rows.length} Ilmberger products`);

let touched = 0;
const samples = [];
for (const r of rows) {
  const derived = deriveBmwModels(r.titleEn);
  if (derived.length === 0) continue; // Not BMW or no model derivable
  const current = new Set(r.tags ?? []);
  const missing = derived.filter((m) => !current.has(m));
  if (missing.length === 0) continue;

  const newTags = [...(r.tags ?? []), ...missing];
  if (samples.length < 20) {
    samples.push({ sku: r.sku, title: r.titleEn, added: missing });
  }
  touched++;

  if (!DRY) {
    await prisma.shopProduct.update({ where: { id: r.id }, data: { tags: newTags } });
  }
}

console.log(`\n${DRY ? "[DRY] " : ""}Touched ${touched}/${rows.length} rows`);
console.log("\nFirst 20 touched products:");
for (const s of samples) {
  console.log(`  + [${s.added.join(", ")}]  ${s.sku} — ${s.title}`);
}
await prisma.$disconnect();
