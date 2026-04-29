import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
// Run with: npx tsx scripts/audit-burger-desc-quality.ts
//
// Analyzes Burger product descriptions to decide which are worth translating:
// - length distribution
// - common boilerplate / junk patterns
// - duplicate / near-duplicate descriptions (could share translation)
// - products that probably need only title translation

function shingles(text: string, n = 6) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { slug: true, titleEn: true, bodyHtmlEn: true, productType: true, priceUsd: true, tags: true },
  });

  console.log(`Total Burger products: ${products.length}\n`);

  // 1. Length distribution
  const lens = products.map((p) => p.bodyHtmlEn?.length || 0).sort((a, b) => a - b);
  const buckets = [
    { label: '0',           min: 0,    max: 0 },
    { label: '1-200',       min: 1,    max: 200 },
    { label: '201-500',     min: 201,  max: 500 },
    { label: '501-1000',    min: 501,  max: 1000 },
    { label: '1001-2000',   min: 1001, max: 2000 },
    { label: '2001-3500',   min: 2001, max: 3500 },
    { label: '3501-5000',   min: 3501, max: 5000 },
    { label: '5001-7500',   min: 5001, max: 7500 },
    { label: '7501+',       min: 7501, max: 1e9  },
  ];
  console.log('=== Description length distribution ===');
  for (const b of buckets) {
    const n = lens.filter((l) => l >= b.min && l <= b.max).length;
    const bar = '█'.repeat(Math.round(n / 5));
    console.log(`  ${b.label.padStart(11)} | ${String(n).padStart(4)} | ${bar}`);
  }
  const total = lens.reduce((a, b) => a + b, 0);
  console.log(`  TOTAL CHARS: ${total.toLocaleString()}\n`);

  // 2. Shortest descriptions (likely no real content)
  const sorted = [...products].sort((a, b) => (a.bodyHtmlEn?.length || 0) - (b.bodyHtmlEn?.length || 0));
  console.log('=== Shortest 8 descriptions ===');
  for (const p of sorted.slice(0, 8)) {
    console.log(`  [${p.bodyHtmlEn?.length || 0}c] ${p.slug}`);
    console.log(`         "${(p.bodyHtmlEn || '').slice(0, 120)}"`);
  }

  console.log('\n=== Longest 5 descriptions ===');
  for (const p of sorted.slice(-5).reverse()) {
    console.log(`  [${p.bodyHtmlEn?.length || 0}c] ${p.slug}`);
    console.log(`         title: "${p.titleEn?.slice(0, 80)}"`);
  }

  // 3. Common boilerplate
  console.log('\n=== Boilerplate phrase counts (across all descriptions) ===');
  const phrases = [
    'Click here',
    'click here',
    'Available here',
    'available here',
    'Sold separately',
    'sold separately',
    'see below',
    'See below',
    'Download the install',
    'Download the JB4',
    'Vehicle Fitment',
    'Features & Benefits',
    "What's included",
    "What's Included",
    'BOTH VERSIONS NOW INCLUDE',
    'Free Shipping',
    'free shipping',
    'Optional',
    'Made in the USA',
    'Made in USA',
    'Designed and assembled',
    '5 year warranty',
    'Backed by',
    '★',
    '⚠',
    '🔒',
  ];
  for (const ph of phrases) {
    const count = products.filter((p) => (p.bodyHtmlEn || '').includes(ph)).length;
    if (count > 0) console.log(`  "${ph}".padEnd(30): ${count} products`);
  }

  // 4. Duplicate/near-duplicate detection
  console.log('\n=== Near-duplicate description groups (Jaccard >= 0.7) ===');
  const sigs = products.map((p) => ({ p, sig: shingles(p.bodyHtmlEn || '', 8) }));
  const visited = new Set<string>();
  const clusters: Array<{ slugs: string[]; sample: string }> = [];
  for (let i = 0; i < sigs.length; i++) {
    if (visited.has(sigs[i].p.slug)) continue;
    const cluster = [sigs[i].p];
    visited.add(sigs[i].p.slug);
    if (sigs[i].sig.size < 30) continue;
    for (let j = i + 1; j < sigs.length; j++) {
      if (visited.has(sigs[j].p.slug)) continue;
      if (sigs[j].sig.size < 30) continue;
      const sim = jaccard(sigs[i].sig, sigs[j].sig);
      if (sim >= 0.7) {
        cluster.push(sigs[j].p);
        visited.add(sigs[j].p.slug);
      }
    }
    if (cluster.length > 1) {
      clusters.push({
        slugs: cluster.map((c) => c.slug),
        sample: cluster[0].titleEn?.slice(0, 80) || '',
      });
    }
  }
  clusters.sort((a, b) => b.slugs.length - a.slugs.length);
  let dupTotal = 0;
  for (const c of clusters.slice(0, 15)) {
    console.log(`  [${c.slugs.length}× near-identical] sample: "${c.sample}"`);
    for (const s of c.slugs.slice(0, 3)) console.log(`     - ${s}`);
    if (c.slugs.length > 3) console.log(`     ... and ${c.slugs.length - 3} more`);
    dupTotal += c.slugs.length;
  }
  console.log(`\n  Total products in near-duplicate groups: ${dupTotal} (${Math.round((dupTotal / products.length) * 100)}%)`);
  console.log(`  Number of unique "templates" they collapse into: ${clusters.length}`);

  // 5. Type breakdown
  console.log('\n=== Type breakdown ===');
  const byType: Record<string, number> = {};
  for (const p of products) {
    const type = (p.tags || []).find((t) => t.startsWith('type:'))?.slice(5) || '(none)';
    byType[type] = (byType[type] || 0) + 1;
  }
  const typeList = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  for (const [t, n] of typeList) console.log(`  ${t.padEnd(28)} ${n}`);

  // 6. Cost projection
  console.log('\n=== Cost projection (gemini-2.5-pro) ===');
  // Assume ~3 chars per token average (English)
  const tokensIn = Math.round(total / 3);
  const tokensOut = Math.round(total / 2.5); // Cyrillic is ~more tokens-per-char
  console.log(`  Estimated input tokens:  ${tokensIn.toLocaleString()}`);
  console.log(`  Estimated output tokens: ${tokensOut.toLocaleString()}`);
  console.log(`  Cost @ pro ($1.25/$10):  $${((tokensIn / 1e6) * 1.25 + (tokensOut / 1e6) * 10).toFixed(2)}`);
  console.log(`  Cost @ flash ($0.30/$2.50): $${((tokensIn / 1e6) * 0.30 + (tokensOut / 1e6) * 2.50).toFixed(2)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
