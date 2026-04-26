import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

console.log('── 1. titleEn coverage ──');
const allTitles = await prisma.shopProduct.findMany({
  where: { brand: { contains: 'RaceChip', mode: 'insensitive' } },
  select: { titleEn: true, titleUa: true, image: true, sku: true, tags: true },
});
const titleStartsWith = new Map();
for (const p of allTitles) {
  const m = p.titleEn?.match(/^(RaceChip\s+\S+\s*\d*)/);
  const k = m ? m[1] : '?';
  titleStartsWith.set(k, (titleStartsWith.get(k) ?? 0) + 1);
}
for (const [k, n] of [...titleStartsWith.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(5)} × "${k}…"`);
}

console.log('\n── 2. SKU prefixes ──');
const skuPrefix = new Map();
for (const p of allTitles) {
  const m = p.sku?.match(/^(RC-[A-Z0-9]+)/);
  const k = m ? m[1] : '?';
  skuPrefix.set(k, (skuPrefix.get(k) ?? 0) + 1);
}
for (const [k, n] of [...skuPrefix.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(5)} × ${k}-…`);
}

console.log('\n── 3. Image variations (top 10) ──');
const images = new Map();
for (const p of allTitles) {
  const k = p.image || '(null)';
  images.set(k, (images.get(k) ?? 0) + 1);
}
for (const [img, n] of [...images.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${n.toString().padStart(5)} × ${img}`);
}

console.log('\n── 4. Tags that mention chip tier ──');
const tierTags = new Map();
for (const p of allTitles) {
  for (const t of (p.tags || [])) {
    if (/tier|gts|black|chip|product/i.test(t)) tierTags.set(t, (tierTags.get(t) ?? 0) + 1);
  }
}
for (const [t, n] of [...tierTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${n.toString().padStart(5)} × ${t}`);
}

console.log('\n── 5. shortDesc variations ──');
const shorts = await prisma.shopProduct.findMany({
  where: { brand: { contains: 'RaceChip', mode: 'insensitive' } },
  select: { shortDescEn: true },
});
const sdMap = new Map();
for (const p of shorts) {
  const k = (p.shortDescEn || '').replace(/\+\d+\s+/g, '+N ').replace(/\d+/g, 'N');
  sdMap.set(k, (sdMap.get(k) ?? 0) + 1);
}
for (const [k, n] of [...sdMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${n.toString().padStart(5)} × "${k}"`);
}

console.log('\n── 6. Raw scrape: which tier is really being selected? ──');
const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'racechip-products.json'), 'utf-8'));
const tiers = new Map();
for (const r of raw) tiers.set(r.selectedTier, (tiers.get(r.selectedTier) ?? 0) + 1);
console.log('  selectedTier in raw:', Object.fromEntries(tiers));

// Look at the image fields the scraper actually saw on page
const productImageMap = new Map();
for (const r of raw) {
  for (const img of r.images || []) {
    if (/product|gts|rs|^.*s_/.test(img)) {
      productImageMap.set(img, (productImageMap.get(img) ?? 0) + 1);
    }
  }
}
console.log('\n── 7. Raw images RaceChip product pages exposed (top 15) ──');
for (const [img, n] of [...productImageMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${n.toString().padStart(5)} × ${img}`);
}

await prisma.$disconnect();
