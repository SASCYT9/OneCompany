#!/usr/bin/env node
/**
 * Persist scraped+translated rich descriptions into ShopProduct.bodyHtmlUa/En
 * by SKU.
 *
 * Per memory/minimal_reimport.md: only writes the two body-HTML fields, leaves
 * everything else untouched. Safe to re-run.
 *
 * Usage:
 *   node scripts/do88/apply-do88-rich.mjs               # apply all
 *   node scripts/do88/apply-do88-rich.mjs --skus LF-210-ST-66r,WC-430
 *   node scripts/do88/apply-do88-rich.mjs --dry-run     # show what would change
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const INPUT = path.join(__dirname, 'scraped', 'do88-rich-translated.json');
const DEV_CACHE = path.join(ROOT, '.shop-products-dev-cache.json');

const args = process.argv.slice(2);
const argVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const SKU_FILTER = argVal('--skus') ? new Set(argVal('--skus').split(',').map((s) => s.trim().toUpperCase())) : null;
const DRY_RUN = args.includes('--dry-run');

async function main() {
  const data = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const prisma = new PrismaClient();

  const entries = Object.entries(data.bySku).filter(([sku, v]) => {
    if (v.error) return false;
    if (!v.bodyHtmlUa || !v.bodyHtmlEn) return false;
    if (SKU_FILTER && !SKU_FILTER.has(sku)) return false;
    return true;
  });

  console.log(`[apply] ${entries.length} SKUs to write${DRY_RUN ? ' (dry-run)' : ''}`);

  let updated = 0;
  let notFound = 0;
  const notFoundSkus = [];

  for (const [sku, v] of entries) {
    // ShopProduct.sku is case-insensitive match in our data; query both forms.
    const product = await prisma.shopProduct.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' } },
      select: { id: true, slug: true, sku: true, bodyHtmlUa: true, bodyHtmlEn: true },
    });

    if (!product) {
      notFound++;
      if (notFoundSkus.length < 10) notFoundSkus.push(sku);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${sku} → ${product.slug} (${(product.bodyHtmlUa || '').length} → ${v.bodyHtmlUa.length} chars UA)`);
    } else {
      await prisma.shopProduct.update({
        where: { id: product.id },
        data: {
          bodyHtmlUa: v.bodyHtmlUa,
          bodyHtmlEn: v.bodyHtmlEn,
        },
      });
    }
    updated++;
  }

  console.log(`[done] updated: ${updated}, not found: ${notFound}`);
  if (notFoundSkus.length) {
    console.log(`[not-found sample] ${notFoundSkus.join(', ')}`);
  }

  // Bust dev cache so dev preview picks up new content (per memory note)
  if (!DRY_RUN) {
    try {
      await fs.unlink(DEV_CACHE);
      console.log(`[cache] deleted ${DEV_CACHE}`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[cache] could not delete:', err.message);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
