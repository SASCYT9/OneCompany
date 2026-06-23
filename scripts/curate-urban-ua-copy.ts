#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

import {
  buildUrbanEditorialCopy,
  computeUrbanUaEditorialUpdate,
  type UrbanEditorialProductInput,
} from '../src/lib/urbanEditorialCopy';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const FORCE_WHEELS = args.has('--force-wheels');
const ONLY_WHEELS = args.has('--only-wheels');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWheelLikeProduct(product: UrbanEditorialProductInput) {
  const category = normalizeWhitespace(product.categoryEn || product.productType).toLowerCase();
  if (category === 'wheels' || category === 'диски') return true;

  return (
    /\b\d{2}"\b/.test(product.titleEn) &&
    (/\b\d+x\d+\b/i.test(product.titleEn) || /\bET\s?-?\d+\b/i.test(product.titleEn))
  );
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      vendor: 'Urban Automotive',
      isPublished: true,
      status: 'ACTIVE',
    },
    orderBy: { slug: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
      shortDescEn: true,
      shortDescUa: true,
      longDescEn: true,
      longDescUa: true,
      bodyHtmlEn: true,
      bodyHtmlUa: true,
      seoTitleUa: true,
      seoDescriptionUa: true,
      brand: true,
      categoryEn: true,
      categoryUa: true,
      productType: true,
      collectionEn: true,
      collectionUa: true,
      tags: true,
    },
  });

  const updates = rows
    .map((row) => {
      const input: UrbanEditorialProductInput = row;
      const wheelLike = isWheelLikeProduct(input);
      if (ONLY_WHEELS && !wheelLike) return null;

      const generated = buildUrbanEditorialCopy(input);
      const data =
        FORCE_WHEELS && wheelLike
          ? {
              titleUa: generated.titleUa,
              shortDescUa: generated.shortDescUa,
              longDescUa: generated.longDescUa,
              bodyHtmlUa: generated.bodyHtmlUa,
              seoTitleUa: generated.seoTitleUa,
              seoDescriptionUa: generated.seoDescriptionUa,
            }
          : computeUrbanUaEditorialUpdate(input);

      if (!data) return null;

      return {
        id: row.id,
        slug: row.slug,
        data,
        preview: generated,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const fieldCounts = updates.reduce<Record<string, number>>((acc, entry) => {
    for (const key of Object.keys(entry.data)) {
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        forceWheels: FORCE_WHEELS,
        onlyWheels: ONLY_WHEELS,
        totalActiveUrban: rows.length,
        updates: updates.length,
        fieldCounts,
        sample: updates.slice(0, 20).map((entry) => ({
          slug: entry.slug,
          keys: Object.keys(entry.data),
          titleUa: entry.data.titleUa ?? entry.preview.titleUa,
          shortDescUa: entry.data.shortDescUa ?? entry.preview.shortDescUa,
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

  for (const entry of updates) {
    await prisma.shopProduct.update({
      where: { id: entry.id },
      data: entry.data,
    });
    console.log(`[updated] ${entry.slug}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
