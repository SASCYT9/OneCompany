/**
 * Strip the scraper-artefact trailing lowercase `r` from do88 SKUs.
 *
 * Context: do88.se ships per-colour variants (BIG-340-3-B / -R / -S), but our
 * scraper picked the SKU from the image filename (BIG-340-3r.jpg — lowercase
 * `r` is just an internal thumbnail naming detail), not from the JSON-LD
 * `sku` field. Result: hundreds of SKUs ended up as `<base>r` or `<base>-r`.
 *
 * Cleanup rules (conservative — only remove what's clearly artefact):
 *   • Trailing `-r` (dash + lone lowercase r)                  → drop
 *   • Trailing lone `r` after a digit (e.g. `BIG-320r`)        → drop
 * Leave alone: any `r` preceded by an uppercase letter (`Br`, `Sr`, `Ir` etc.
 * — these are real do88 variant/finish codes on some SKUs and we shouldn't
 * touch them blindly).
 *
 * Usage:
 *   node scripts/do88/strip-sku-r-suffix.mjs              # dry-run
 *   node scripts/do88/strip-sku-r-suffix.mjs --apply      # write changes
 *
 * Touches: only ShopProduct.sku for products where brand="DO88" /
 * ShopProductVariant.sku where its parent is DO88. Nothing else.
 *
 * Note: slugs are NOT updated — old URLs still resolve. If we later want
 * canonical slug rewrites, that's a separate migration.
 */

import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const dryRun = !apply;

const prisma = new PrismaClient();

function cleanSku(sku) {
  if (!sku) return sku;
  // `-r` at the end
  let cleaned = sku.replace(/-r$/, "");
  if (cleaned !== sku) return cleaned;
  // lone `r` directly after a digit
  cleaned = sku.replace(/(?<=\d)r$/, "");
  return cleaned;
}

const products = await prisma.shopProduct.findMany({
  where: { brand: { in: ["DO88", "do88", "Do88"] } },
  select: {
    id: true,
    sku: true,
    slug: true,
    titleEn: true,
    variants: { select: { id: true, sku: true } },
  },
});

const productChanges = [];
const variantChanges = [];
const conflicts = [];

const allCurrentSkus = new Set(products.map((p) => p.sku).filter(Boolean));

for (const p of products) {
  if (!p.sku) continue;
  const next = cleanSku(p.sku);
  if (next === p.sku) continue;
  if (!next) {
    conflicts.push({ id: p.id, from: p.sku, to: next, reason: "empty after strip" });
    continue;
  }
  if (allCurrentSkus.has(next) && next !== p.sku) {
    conflicts.push({
      id: p.id,
      from: p.sku,
      to: next,
      reason: "target SKU already exists on another product",
    });
    continue;
  }
  productChanges.push({ id: p.id, from: p.sku, to: next, slug: p.slug, title: p.titleEn });
}

for (const p of products) {
  for (const v of p.variants ?? []) {
    if (!v.sku) continue;
    const next = cleanSku(v.sku);
    if (next === v.sku) continue;
    if (!next) continue;
    variantChanges.push({ id: v.id, from: v.sku, to: next, productSku: p.sku });
  }
}

console.log(`Scanned ${products.length} do88 products.`);
console.log(`Product SKU changes: ${productChanges.length}`);
console.log(`Variant SKU changes: ${variantChanges.length}`);
console.log(`Conflicts (skipped): ${conflicts.length}`);
console.log();

if (conflicts.length) {
  console.log("== Conflicts (won't be touched) ==");
  for (const c of conflicts)
    console.log(`  ${c.from.padEnd(22)} → ${c.to.padEnd(22)}  [${c.reason}]`);
  console.log();
}

console.log("== Sample of first 20 product changes ==");
for (const c of productChanges.slice(0, 20)) {
  console.log(`  ${c.from.padEnd(22)} → ${c.to.padEnd(22)}  ${c.title?.slice(0, 50) ?? ""}`);
}
if (productChanges.length > 20) console.log(`  ... and ${productChanges.length - 20} more`);
console.log();

if (dryRun) {
  console.log("DRY-RUN — no writes. Re-run with --apply to commit.");
  await prisma.$disconnect();
  process.exit(0);
}

let pOk = 0;
let vOk = 0;
for (const c of productChanges) {
  await prisma.shopProduct.update({ where: { id: c.id }, data: { sku: c.to } });
  pOk++;
}
for (const c of variantChanges) {
  await prisma.shopProductVariant.update({ where: { id: c.id }, data: { sku: c.to } });
  vOk++;
}

console.log(`✓ Updated ${pOk} product SKUs and ${vOk} variant SKUs.`);

await prisma.$disconnect();
