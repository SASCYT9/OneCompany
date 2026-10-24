/**
 * Adds variants that were held back (no shipping weight yet) to Valvetronic products that are
 * already on the site, once weights.json prices them. Existing variants, product fields and
 * photos are left as they are; new variants go after the existing ones.
 *
 *   npx tsx --conditions=react-server scripts/valvetronic/add-valvetronic-variants.ts            # report
 *   npx tsx --conditions=react-server scripts/valvetronic/add-valvetronic-variants.ts --commit   # apply
 *
 * Then copy the new variant photos to Blob (migrate-shop-product-media-to-blob.ts) and drain
 * the catalog outbox (activate-valvetronic-catalog.ts --commit).
 */
import { PrismaClient } from "@prisma/client";

import {
  adminProductImportMergeSelect,
  buildAdminProductImportUpdateData,
} from "../../src/lib/shopAdminCatalog";
import { buildShopCatalogAdminSnapshot } from "../../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../../src/lib/shopCatalogMutationCoordinator.server";
import { VALVETRONIC_BRAND } from "../../src/lib/valvetronicCatalog";
import { loadValvetronicImport } from "../import-valvetronic-catalog-drafts";

async function main() {
  const commit = process.argv.includes("--commit");
  const { payloads } = await loadValvetronicImport();
  const bySku = new Map(payloads.map((payload) => [payload.sku, payload]));
  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: VALVETRONIC_BRAND, status: "ACTIVE" },
      select: { ...adminProductImportMergeSelect, sku: true, slug: true, catalogVersion: true },
    });
    const additions = products.flatMap((product) => {
      const payload = bySku.get(product.sku ?? "");
      if (!payload) return [];
      const stored = new Set(product.variants.map((variant) => variant.sku));
      const options = (variant: {
        option1Value?: string | null;
        option2Value?: string | null;
        option3Value?: string | null;
      }) => [variant.option1Value, variant.option2Value, variant.option3Value].join("|");
      const notStored = payload.variants.filter((variant) => !stored.has(variant.sku ?? null));
      // A variant already on the site under another SKU (the brand repeats JEEP.JL.AXL.BLK on
      // two engines, so both now carry our VTD-<id>) keeps its row and only takes the new SKU.
      const renames = notStored.flatMap((variant) => {
        const row = product.variants.find(
          (candidate) =>
            options(candidate) === options(variant) &&
            !payload.variants.some((item) => item.sku === candidate.sku)
        );
        return row ? [{ id: row.id, from: row.sku, to: variant.sku ?? null }] : [];
      });
      const missing = notStored.filter(
        (variant) => !renames.some((rename) => rename.to === (variant.sku ?? null))
      );
      if (!missing.length && !renames.length) return [];
      const lastPosition = Math.max(0, ...product.variants.map((variant) => variant.position));
      const newVariants = missing.map((variant, index) => ({
        ...variant,
        position: lastPosition + index + 1,
        isDefault: false,
      }));
      return [{ product, renames, payload: { ...payload, variants: newVariants } }];
    });
    const report = {
      mode: commit ? "commit" : "report",
      products: additions.length,
      variants: additions.flatMap(({ product, payload }) =>
        payload.variants.map(
          (variant) => `${product.slug}: ${variant.sku} ${variant.title} $${variant.priceUsd}`
        )
      ),
      skuRenames: additions.flatMap(({ product, renames }) =>
        renames.map((rename) => `${product.slug}: ${rename.from} → ${rename.to}`)
      ),
    };
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    for (const { product, renames, payload } of additions) {
      await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: product.id,
        expectedCatalogVersion: product.catalogVersion.toString(),
        changeDomains: ["PRICE", "INVENTORY", "CONTENT"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          for (const rename of renames) {
            await tx.shopProductVariant.update({
              where: { id: rename.id },
              data: { sku: rename.to },
            });
          }
          // The merge matches stored variants by SKU: give it the renamed rows.
          const current = {
            ...product,
            variants: product.variants.map((variant) => ({
              ...variant,
              sku: renames.find((rename) => rename.id === variant.id)?.to ?? variant.sku,
            })),
          };
          if (!payload.variants.length) {
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "IMPORT",
              id: "valvetronic-import@system.local",
              reason: "valvetronic.add-variants",
            });
          }
          await tx.shopProduct.update({
            where: { id: product.id },
            // Option value lists and the new variants only: no product scalar, no media.
            data: buildAdminProductImportUpdateData(
              payload,
              current,
              {
                tags: false,
                collections: false,
                media: false,
                options: true,
                variants: true,
                metafields: false,
              },
              { product: {}, options: { values: [1, 2, 3] }, variants: {} }
            ),
          });
          return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
            type: "IMPORT",
            id: "valvetronic-import@system.local",
            reason: "valvetronic.add-variants",
          });
        },
      });
    }
    process.stdout.write(`${JSON.stringify({ ...report, applied: additions.length }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
