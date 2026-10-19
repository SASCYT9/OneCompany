/**
 * Keeps Link ECU prices equal to the current EU RRP × 1.20 from linkecu.com
 * (the regular price, never a sale price).
 * Only EUR prices change; texts, photos and fitment are never touched.
 *
 *   npx tsx --conditions=react-server scripts/link-ecu/sync-link-ecu-prices.ts            # report
 *   npx tsx --conditions=react-server scripts/link-ecu/sync-link-ecu-prices.ts --commit   # apply
 */
import { PrismaClient } from "@prisma/client";

import {
  LINK_ECU_BRAND,
  LINK_ECU_SOURCE_FEED,
  calculateLinkEcuPriceEur,
} from "../../src/lib/linkEcuCatalog";
import { buildShopCatalogAdminSnapshot } from "../../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../../src/lib/shopCatalogMutationCoordinator.server";

type ShopifyFeed = {
  products: Array<{
    title: string;
    variants: Array<{ sku: string | null; price: string; compare_at_price?: string | null }>;
  }>;
};

async function main() {
  const commit = process.argv.includes("--commit");
  const response = await fetch(`${LINK_ECU_SOURCE_FEED.replace("?", "?limit=250&")}`, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; OneCompanyCatalog/1.0; +https://onecompany.global)",
    },
  });
  if (!response.ok) throw new Error(`linkecu.com feed returned ${response.status}`);
  const feed = (await response.json()) as ShopifyFeed;
  const rrpBySku = new Map<string, number>();
  for (const product of feed.products) {
    for (const variant of product.variants) {
      const sku = String(variant.sku ?? "").trim();
      // RRP is the regular price: during a sale Shopify keeps it in compare_at_price.
      const rrp = Math.max(Number(variant.price), Number(variant.compare_at_price) || 0);
      if (sku) rrpBySku.set(sku, rrp);
    }
  }

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: LINK_ECU_BRAND },
      select: {
        id: true,
        sku: true,
        priceEur: true,
        catalogVersion: true,
        variants: { select: { id: true, sku: true, priceEur: true } },
      },
    });
    const changes = [];
    const missing: string[] = [];
    for (const product of products) {
      const rrp = rrpBySku.get(String(product.sku ?? ""));
      if (!rrp || !(rrp > 0)) {
        missing.push(product.sku ?? product.id);
        continue;
      }
      const priceEur = calculateLinkEcuPriceEur(rrp);
      if (Math.abs(Number(product.priceEur ?? 0) - priceEur) >= 0.01) {
        changes.push({ product, rrp, from: Number(product.priceEur ?? 0), to: priceEur });
      }
    }
    const report = {
      mode: commit ? "commit" : "report",
      productsOnSite: products.length,
      changes: changes.map(
        (change) => `${change.product.sku}: €${change.from} → €${change.to} (RRP €${change.rrp})`
      ),
      notInFeed: missing,
    };
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    for (const change of changes) {
      await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: change.product.id,
        expectedCatalogVersion: change.product.catalogVersion.toString(),
        changeDomains: ["PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          await tx.shopProduct.update({
            where: { id: change.product.id },
            data: { priceEur: change.to, priceSourceCurrency: "EUR" },
          });
          for (const variant of change.product.variants) {
            await tx.shopProductVariant.update({
              where: { id: variant.id },
              data: { priceEur: change.to, priceSourceCurrency: "EUR" },
            });
          }
          return buildShopCatalogAdminSnapshot(tx, change.product.id, nextCatalogVersion, {
            type: "IMPORT",
            id: "link-ecu-price-sync@system.local",
            reason: "link-ecu.price-sync",
          });
        },
      });
    }
    process.stdout.write(`${JSON.stringify({ ...report, applied: changes.length }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
