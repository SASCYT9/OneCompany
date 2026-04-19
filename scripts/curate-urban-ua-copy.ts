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
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;

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
      const data = computeUrbanUaEditorialUpdate(input);

      if (!data) return null;

      return {
        id: row.id,
        slug: row.slug,
        data,
        preview: buildUrbanEditorialCopy(input),
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
