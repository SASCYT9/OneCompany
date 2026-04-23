#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

import {
  buildUrbanGpSafeFallbackDescription,
  isUnsafeUrbanGpDescription,
} from '../src/lib/urbanGpDescriptionFallback';
import { resolveEnglishCategory } from '../src/lib/shopCategoryTranslation';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;
const BACKUP_DIR = path.join(process.cwd(), 'backups', 'urban-gp-description-cleanup');

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function plainPreview(value: string | null | undefined, max = 320) {
  const plain = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= max) {
    return plain;
  }

  return `${plain.slice(0, max).trimEnd()}...`;
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      vendor: { equals: 'Urban Automotive', mode: 'insensitive' },
      status: 'ACTIVE',
      isPublished: true,
    },
    orderBy: { slug: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
    select: {
      id: true,
      slug: true,
      sku: true,
      titleUa: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
      collectionUa: true,
      collectionEn: true,
      brand: true,
      vendor: true,
      productType: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      seoDescriptionUa: true,
      seoDescriptionEn: true,
      variants: {
        orderBy: { position: 'asc' },
        take: 1,
        select: {
          sku: true,
        },
      },
    },
  });

  const targets = rows
    .filter((row) =>
      [
        row.shortDescUa,
        row.shortDescEn,
        row.longDescUa,
        row.longDescEn,
        row.bodyHtmlUa,
        row.bodyHtmlEn,
        row.seoDescriptionUa,
        row.seoDescriptionEn,
      ].some(isUnsafeUrbanGpDescription)
    )
    .map((row) => {
      const fallback = buildUrbanGpSafeFallbackDescription({
        slug: row.slug,
        sku: row.sku ?? row.variants[0]?.sku ?? '',
        titleUa: row.titleUa,
        titleEn: row.titleEn,
        categoryUa: row.categoryUa,
        categoryEn: resolveEnglishCategory(row.categoryEn, row.categoryUa) || row.categoryEn || '',
        collectionUa: row.collectionUa,
        collectionEn: row.collectionEn,
        brand: row.brand,
        vendor: row.vendor,
        productType: row.productType,
      });

      return {
        row,
        data: {
          shortDescUa: fallback.shortDescription.ua,
          shortDescEn: fallback.shortDescription.en,
          longDescUa: fallback.longDescription.ua,
          longDescEn: fallback.longDescription.en,
          bodyHtmlUa: fallback.bodyHtml.ua,
          bodyHtmlEn: fallback.bodyHtml.en,
          seoDescriptionUa: fallback.seoDescription.ua,
          seoDescriptionEn: fallback.seoDescription.en,
        },
      };
    });

  const byCategory = targets.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.row.categoryEn ?? '(none)';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        scanned: rows.length,
        targets: targets.length,
        byCategory,
        sample: targets.slice(0, 20).map(({ row, data }) => ({
          slug: row.slug,
          sku: row.sku,
          titleEn: row.titleEn,
          shortDescEn: data.shortDescEn,
          shortDescUa: data.shortDescUa,
          bodyHtmlEn: plainPreview(data.bodyHtmlEn),
          bodyHtmlUa: plainPreview(data.bodyHtmlUa),
        })),
      },
      null,
      2
    )
  );

  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `urban-gp-description-cleanup-${nowStamp()}.json`);
  await fs.writeFile(
    backupPath,
    JSON.stringify(
      targets.map(({ row }) => row),
      null,
      2
    ),
    'utf8'
  );

  for (const { row, data } of targets) {
    await prisma.shopProduct.update({
      where: { id: row.id },
      data,
    });
    console.log(`[updated] ${row.slug}`);
  }

  console.log(JSON.stringify({ committed: true, updated: targets.length, backupPath }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
