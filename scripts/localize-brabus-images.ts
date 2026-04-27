#!/usr/bin/env tsx
/*
 * Migrate Brabus product images from external brabus.com CDN URLs to local
 * /brabus-images/<sku>_0.jpg paths.
 *
 * - For each product whose `image` field starts with brabus.com, check if a
 *   matching file exists in public/brabus-images/.
 * - If yes, just rewrite the field to /brabus-images/<sku>_0.jpg.
 * - If no local file, download from the external URL and save it, then
 *   rewrite the field.
 *
 * Usage:
 *   tsx scripts/localize-brabus-images.ts             (dry-run; default)
 *   tsx scripts/localize-brabus-images.ts --commit
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public', 'brabus-images');

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36' },
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return false; // sanity guard against error pages
    await fs.writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== Brabus image localization ===');
  console.log('Mode:', COMMIT ? 'COMMIT' : 'DRY RUN');

  const products = await prisma.shopProduct.findMany({
    where: { brand: { equals: 'brabus', mode: 'insensitive' } },
    select: { id: true, sku: true, image: true },
  });
  const external = products.filter((p) => (p.image || '').includes('brabus.com'));

  let swapped = 0;
  let downloaded = 0;
  let failed = 0;
  const failures: Array<{ sku: string; url: string; reason: string }> = [];

  for (const p of external) {
    const skuLower = (p.sku || '').toLowerCase();
    if (!skuLower) continue;
    const fileName = `${skuLower}_0.jpg`;
    const localPath = path.join(PUBLIC_DIR, fileName);
    const newImage = `/brabus-images/${fileName}`;

    if (!existsSync(localPath)) {
      if (!COMMIT) {
        downloaded++;
        continue;
      }
      const ok = await downloadImage(p.image!, localPath);
      if (!ok) {
        failed++;
        failures.push({ sku: p.sku!, url: p.image!, reason: 'download failed' });
        continue;
      }
      downloaded++;
    }

    if (COMMIT) {
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: { image: newImage },
      });
    }
    swapped++;
  }

  console.log(`\nExternal images: ${external.length}`);
  console.log(`Swapped to local path: ${swapped}`);
  console.log(`Downloaded fresh: ${downloaded}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  ${f.sku} ← ${f.url.slice(0, 80)} (${f.reason})`));
  }

  if (!COMMIT) console.log('\n(dry-run) — pass --commit to apply.');
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
