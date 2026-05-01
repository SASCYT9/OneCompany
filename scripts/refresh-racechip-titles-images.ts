/**
 * RaceChip Title + Image Refresh
 *
 * Re-renders titleEn / titleUa / image for every RaceChip ShopProduct using
 * the cleaned-up formatters in src/lib/racechipFormat. Does NOT touch
 * descriptions, prices, tags, SKUs, or variants — preserves any polished
 * UA copy that may exist in the DB beyond the import-script template.
 *
 * Source of truth: data/racechip-products.json (matched to DB rows by slug).
 * DB rows whose slug isn't in the JSON are left untouched.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env' });

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  formatRacechipMake,
  formatRacechipModel,
  formatRacechipEngine,
  extractRacechipYears,
} from '../src/lib/racechipFormat';

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

interface ScrapedProduct {
  url: string;
  makeSlug: string;
  modelSlug: string;
  engineSlug: string;
  ccm: number;
  images: string[];
}

function generateSlug(p: ScrapedProduct): string {
  return `racechip-gts5-${p.makeSlug}-${p.modelSlug}-${p.engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

function formatTitleEngine(slug: string, ccm: number): string {
  // The title wants engine NAME + displacement (no HP/kW/Nm — those are in
  // the short/long description). Strip the spec tail and reuse shared
  // formatter for clean tokenization.
  const stripped = slug.replace(/-\d+ccm.*$/, '');
  const name = formatRacechipEngine(stripped);
  return `${name} ${ccm}cc`.trim();
}

function generateTitle(p: ScrapedProduct): string {
  const make = formatRacechipMake(p.makeSlug);
  const model = formatRacechipModel(p.modelSlug);
  const years = extractRacechipYears(p.modelSlug);
  const engine = formatTitleEngine(p.engineSlug, p.ccm);
  const yearStr = years ? ` (${years})` : '';
  return `RaceChip GTS 5 — ${make} ${model}${yearStr} ${engine}`.trim();
}

function pickImage(images: string[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const find = (needle: string) => images.find((i) => i.includes(needle));
  return (
    find('gts-black-three-quarter') ||
    find('gts-three-quarter') ||
    find('product-gts-connect_shop') ||
    find('product-gts_shop') ||
    images[0] ||
    null
  );
}

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'racechip-products.json');
  const products: ScrapedProduct[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Loaded ${products.length} scraped products`);

  // Deduplicate JSON by generated slug (the JSON often has multiple entries
  // per URL after retries — last write wins for image selection).
  const bySlug = new Map<string, ScrapedProduct>();
  for (const p of products) {
    bySlug.set(generateSlug(p), p);
  }
  console.log(`🔍 ${bySlug.size} unique slugs after dedup`);

  // Pull the DB rows we'll touch
  const rows = await prisma.shopProduct.findMany({
    where: { brand: { contains: 'RaceChip', mode: 'insensitive' } },
    select: { id: true, slug: true, titleEn: true, titleUa: true, image: true },
  });
  console.log(`🗃  ${rows.length} RaceChip rows in DB`);

  let titleChanged = 0;
  let imageChanged = 0;
  let untouched = 0;
  let notInJson = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const p = bySlug.get(row.slug);
    if (!p) {
      notInJson++;
      continue;
    }

    const newTitle = generateTitle(p);
    const newImage = pickImage(p.images);

    const titleNeeds = newTitle !== row.titleEn || newTitle !== row.titleUa;
    const imageNeeds = !!newImage && newImage !== row.image;

    if (!titleNeeds && !imageNeeds) {
      untouched++;
      continue;
    }

    const data: { titleEn?: string; titleUa?: string; image?: string } = {};
    if (titleNeeds) {
      data.titleEn = newTitle;
      data.titleUa = newTitle;
      titleChanged++;
    }
    if (imageNeeds) {
      data.image = newImage!;
      imageChanged++;
    }

    await prisma.shopProduct.update({ where: { id: row.id }, data });

    if ((i + 1) % 200 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`  ⏳ ${i + 1}/${rows.length} (${rate}/sec, ${elapsed}s)`);
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Refresh complete in ${totalSec}s`);
  console.log(`   Title updated:  ${titleChanged}`);
  console.log(`   Image updated:  ${imageChanged}`);
  console.log(`   Already clean:  ${untouched}`);
  console.log(`   No JSON match:  ${notInJson}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
