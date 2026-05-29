/**
 * Audit UA fields across ALL Ilmberger products (not just the 90 new ones).
 * Surface which SKUs still need translation work.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
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
  },
});
console.log(`Scanning ${rows.length} Ilmberger products\n`);

const stats = {
  emptyTitleUa: [],
  emptyShortDescUa: [],
  emptyBodyHtmlUa: [],
  emptySeoTitleUa: [],
  emptySeoDescriptionUa: [],
  shortDescUntranslated: [],
  bodyHtmlUntranslated: [],
};

for (const r of rows) {
  if (!r.titleUa?.trim()) stats.emptyTitleUa.push(r.sku);
  if (!r.shortDescUa?.trim()) stats.emptyShortDescUa.push(r.sku);
  if (!r.bodyHtmlUa?.trim()) stats.emptyBodyHtmlUa.push(r.sku);
  if (!r.seoTitleUa?.trim()) stats.emptySeoTitleUa.push(r.sku);
  if (!r.seoDescriptionUa?.trim()) stats.emptySeoDescriptionUa.push(r.sku);
  if (r.shortDescUa && r.shortDescEn && r.shortDescUa === r.shortDescEn)
    stats.shortDescUntranslated.push(r.sku);
  if (r.bodyHtmlUa && r.bodyHtmlEn && r.bodyHtmlUa === r.bodyHtmlEn)
    stats.bodyHtmlUntranslated.push(r.sku);
}

const total = rows.length;
const printRow = (label, list) => {
  const n = list.length;
  const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0";
  console.log(`  ${label.padEnd(34)} ${String(n).padStart(4)} / ${total}  (${pct}%)`);
};

console.log("═══════════════════════════════════════════════════════════════════");
console.log("  Ilmberger UA-field completeness (all 356 products)");
console.log("═══════════════════════════════════════════════════════════════════");
printRow("Missing titleUa", stats.emptyTitleUa);
printRow("Missing shortDescUa", stats.emptyShortDescUa);
printRow("Missing bodyHtmlUa", stats.emptyBodyHtmlUa);
printRow("Missing seoTitleUa", stats.emptySeoTitleUa);
printRow("Missing seoDescriptionUa", stats.emptySeoDescriptionUa);
printRow("shortDescUa === shortDescEn (un-XL'd)", stats.shortDescUntranslated);
printRow("bodyHtmlUa === bodyHtmlEn (un-XL'd)", stats.bodyHtmlUntranslated);

console.log("\nMissing SEO field SKUs (sample of 30):");
const seoMissing = [...new Set([...stats.emptySeoTitleUa, ...stats.emptySeoDescriptionUa])];
for (const sku of seoMissing.slice(0, 30)) console.log(`  ${sku}`);
if (seoMissing.length > 30) console.log(`  ... +${seoMissing.length - 30} more`);
console.log(`\nTotal SKUs missing SEO fields: ${seoMissing.length}`);

await prisma.$disconnect();
