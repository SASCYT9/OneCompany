/**
 * One-shot cleanup: collapse duplicate ShopProductVariant rows that share
 * (productId, sku). Caused by an old iPE import bug where the same SKU could
 * be emitted as multiple variant candidates per product. The forward fix lives
 * in scripts/import-ipe-catalog.ts (dedupe by SKU before persistence) — this
 * script handles existing data. Pass --apply to actually delete; default is
 * dry-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const dupGroups = await prisma.$queryRaw<
    Array<{ productId: string; sku: string; ids: string[] }>
  >`
    SELECT "productId", "sku", array_agg("id" ORDER BY "createdAt", "id") AS ids
    FROM "ShopProductVariant"
    WHERE "sku" IS NOT NULL AND "sku" <> ''
    GROUP BY "productId", "sku"
    HAVING COUNT(*) > 1
  `;

  console.log(`Duplicate (productId, sku) groups: ${dupGroups.length}`);

  let toDelete: string[] = [];
  let kept = 0;
  for (const group of dupGroups) {
    const rows = await prisma.shopProductVariant.findMany({
      where: { id: { in: group.ids } },
      select: { id: true, position: true, isDefault: true, sku: true, priceUsd: true },
    });

    // Pick the canonical row: prefer isDefault=true, then lowest position, then lowest id.
    rows.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      const posDiff = (a.position ?? 0) - (b.position ?? 0);
      if (posDiff !== 0) return posDiff;
      return a.id.localeCompare(b.id);
    });

    const [keepRow, ...dropRows] = rows;
    kept++;
    toDelete.push(...dropRows.map((r) => r.id));
    console.log(
      `  sku=${group.sku} → keep ${keepRow.id} (pos=${keepRow.position}, isDefault=${keepRow.isDefault}); drop ${dropRows.length}`
    );
  }

  console.log(`\nWill keep ${kept} canonical rows; delete ${toDelete.length} duplicates.`);

  // Safety: confirm none of the to-delete ids are referenced by FKs.
  const [orderRefs, cartRefs, bundleRefs, invRefs] = await Promise.all([
    prisma.shopOrderItem.count({ where: { variantId: { in: toDelete } } }),
    prisma.shopCartItem.count({ where: { variantId: { in: toDelete } } }),
    prisma.shopBundleItem.count({ where: { componentVariantId: { in: toDelete } } }),
    prisma.shopInventoryLevel.count({ where: { variantId: { in: toDelete } } }),
  ]);
  console.log(
    `FK refs to to-delete rows: orders=${orderRefs} carts=${cartRefs} bundles=${bundleRefs} inventory=${invRefs}`
  );
  if (orderRefs + cartRefs + bundleRefs + invRefs > 0) {
    throw new Error('FK references found — refusing to delete.');
  }

  if (!apply) {
    console.log('\nDry-run. Re-run with --apply to delete.');
    return;
  }

  const result = await prisma.shopProductVariant.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`\nDeleted ${result.count} duplicate variant rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
