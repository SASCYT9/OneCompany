/**
 * Applies a new Dinan / APR dealer price list to products already on the site.
 * Only USD prices change: titles, texts, photos and fitment are never touched.
 *
 *   python -I -X utf8 scripts/supplier-price-list/price-list-to-json.py "<new price list>.xlsx" data/<brand>/price-list.json
 *   npx tsx --conditions=react-server scripts/holley/update-holley-prices.ts --brand=dinan --usd-uah=45.99            # report
 *   npx tsx --conditions=react-server scripts/holley/update-holley-prices.ts --brand=dinan --usd-uah=45.99 --commit   # apply
 *
 * The report also lists SKUs that are new in the price list (they need content
 * before import) and SKUs the brand no longer sells (status OBS / missing).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../../src/lib/shopCatalogMutationCoordinator.server";
import {
  HOLLEY_BRANDS,
  decideHolleyPriceUsd,
  type HolleyBrandKey,
  type HolleyPriceListItem,
} from "../../src/lib/holleyBrandCatalog";

function arg(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
}

async function competitorPrices(dir: string, usdUah: number) {
  const prices = new Map<string, number[]>();
  for (const file of (await readdir(dir)).filter((name) => name.startsWith("competitor-"))) {
    const data = JSON.parse(await readFile(path.join(dir, file), "utf8")) as {
      products: Array<{ mpn?: string | null; price?: number | null; currency?: string | null }>;
    };
    for (const product of data.products) {
      const mpn = String(product.mpn ?? "")
        .trim()
        .toUpperCase();
      if (!mpn || !product.price || product.currency !== "UAH") continue;
      prices.set(mpn, [
        ...(prices.get(mpn) ?? []),
        Math.round((product.price / usdUah) * 100) / 100,
      ]);
    }
  }
  return prices;
}

async function main() {
  const brand = arg("brand") as HolleyBrandKey | undefined;
  if (brand !== "dinan" && brand !== "apr") throw new Error("--brand=dinan|apr is required");
  const usdUah = Number(arg("usd-uah"));
  if (!Number.isFinite(usdUah) || usdUah <= 0) throw new Error("--usd-uah is required");
  const commit = process.argv.includes("--commit");
  const dir = path.resolve("data", brand);
  const priceList = JSON.parse(await readFile(path.join(dir, "price-list.json"), "utf8")) as {
    sourceFile: string;
    items: HolleyPriceListItem[];
  };
  const bySku = new Map(priceList.items.map((item) => [item.sku.toUpperCase(), item]));
  const competitors = await competitorPrices(dir, usdUah);
  const brandName = HOLLEY_BRANDS[brand].brand;

  const prisma = new PrismaClient();
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: brandName },
      select: {
        id: true,
        sku: true,
        slug: true,
        priceUsd: true,
        catalogVersion: true,
        variants: { select: { id: true, sku: true, priceUsd: true, isDefault: true } },
      },
    });
    const onSite = new Set<string>();
    const changes: Array<{
      productId: string;
      slug: string;
      catalogVersion: bigint;
      productPriceUsd: number | null;
      variants: Array<{ id: string; sku: string; from: number; to: number; rule: string }>;
    }> = [];
    const discontinued: string[] = [];
    for (const product of products) {
      const variantChanges = [];
      let productPriceUsd: number | null = null;
      for (const variant of product.variants) {
        const sku = String(variant.sku ?? "").toUpperCase();
        onSite.add(sku);
        const item = bySku.get(sku);
        if (!item || item.status !== "Active" || !item.retailUsd) {
          discontinued.push(variant.sku ?? "");
          continue;
        }
        const decision = decideHolleyPriceUsd({
          retailUsd: item.retailUsd,
          mapUsd: item.mapUsd,
          weightLb: item.weightLb ?? 0,
          competitorUsd: competitors.get(sku) ?? [],
        });
        const current = Number(variant.priceUsd ?? 0);
        if (variant.isDefault) productPriceUsd = decision.priceUsd;
        if (Math.abs(current - decision.priceUsd) >= 0.01) {
          variantChanges.push({
            id: variant.id,
            sku: variant.sku ?? "",
            from: current,
            to: decision.priceUsd,
            rule: decision.rule,
          });
        }
      }
      if (variantChanges.length) {
        changes.push({
          productId: product.id,
          slug: product.slug,
          catalogVersion: product.catalogVersion,
          productPriceUsd,
          variants: variantChanges,
        });
      }
    }
    const newSkus = priceList.items
      .filter(
        (item) => item.status === "Active" && item.retailUsd && !onSite.has(item.sku.toUpperCase())
      )
      .map((item) => item.sku);

    const report = {
      mode: commit ? "commit" : "report",
      brand,
      priceList: priceList.sourceFile,
      productsOnSite: products.length,
      priceChanges: changes.reduce((sum, change) => sum + change.variants.length, 0),
      changes: changes.flatMap((change) =>
        change.variants.map(
          (variant) => `${variant.sku}: $${variant.from} → $${variant.to} (${variant.rule})`
        )
      ),
      discontinued,
      newInPriceList: newSkus,
    };
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    for (const change of changes) {
      await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: change.productId,
        expectedCatalogVersion: change.catalogVersion.toString(),
        changeDomains: ["PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          if (change.productPriceUsd !== null) {
            await tx.shopProduct.update({
              where: { id: change.productId },
              data: { priceUsd: change.productPriceUsd, priceSourceCurrency: "USD" },
            });
          }
          for (const variant of change.variants) {
            await tx.shopProductVariant.update({
              where: { id: variant.id },
              data: { priceUsd: variant.to, priceSourceCurrency: "USD" },
            });
          }
          return buildShopCatalogAdminSnapshot(tx, change.productId, nextCatalogVersion, {
            type: "IMPORT",
            id: `${brand}-price-list@system.local`,
            reason: `${brand}.price-list:${priceList.sourceFile}`,
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
