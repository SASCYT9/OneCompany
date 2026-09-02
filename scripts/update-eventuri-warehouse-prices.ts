#!/usr/bin/env tsx

import { Prisma, PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

dotenv.config({ path: ".env.local", override: true });
const prisma = new PrismaClient();
const COMMIT = process.argv.includes("--commit");
const PRICE_USD_BY_SKU = new Map([
  ["EVE-W192-FTR", 140],
  ["EVE-FLC", 50],
]);

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { in: [...PRICE_USD_BY_SKU.keys()] } },
        { variants: { some: { sku: { in: [...PRICE_USD_BY_SKU.keys()] } } } },
      ],
    },
    select: {
      id: true, slug: true, sku: true, priceUsd: true, priceEur: true, priceEurEurope: true, priceUah: true, catalogVersion: true,
      variants: { select: { id: true, sku: true, priceUsd: true, priceEur: true, priceEurEurope: true, priceUah: true } },
    },
    orderBy: { slug: "asc" },
  });

  const updates = rows.map((row) => {
    const sku = row.sku?.trim().toUpperCase() || row.variants.find((variant) => PRICE_USD_BY_SKU.has(variant.sku?.trim().toUpperCase() ?? ""))?.sku?.trim().toUpperCase();
    const nextPrice = sku ? PRICE_USD_BY_SKU.get(sku) : undefined;
    if (!sku || nextPrice == null) throw new Error(`Cannot resolve approved SKU for ${row.slug}`);
    const variantIds = row.variants.filter((variant) => variant.sku?.trim().toUpperCase() === sku).map((variant) => variant.id);
    if (!variantIds.length) throw new Error(`No exact ${sku} variant for ${row.slug}`);
    const hasStaleRegionalPrice = Boolean(row.priceEur || row.priceEurEurope || row.priceUah) || row.variants.some((variant) => variantIds.includes(variant.id) && Boolean(variant.priceEur || variant.priceEurEurope || variant.priceUah));
    return { ...row, sku, nextPrice, variantIds, changed: Number(row.priceUsd) !== nextPrice || hasStaleRegionalPrice || row.variants.some((variant) => variantIds.includes(variant.id) && Number(variant.priceUsd) !== nextPrice) };
  }).filter((row) => row.changed);

  const foundSkus = new Set(rows.flatMap((row) => [row.sku, ...row.variants.map((variant) => variant.sku)]).map((sku) => sku?.trim().toUpperCase()).filter(Boolean));
  const missing = [...PRICE_USD_BY_SKU.keys()].filter((sku) => !foundSkus.has(sku));
  if (missing.length) throw new Error(`Missing approved SKU(s): ${missing.join(", ")}`);

  console.log(JSON.stringify({ mode: COMMIT ? "commit" : "dry-run", updates: updates.map(({ slug, sku, priceUsd, nextPrice }) => ({ slug, sku, previousUsd: priceUsd?.toString() ?? null, nextUsd: nextPrice })) }, null, 2));
  if (!COMMIT) return;

  for (const row of updates) {
    const priceUsd = new Prisma.Decimal(row.nextPrice);
    await coordinateShopCatalogProductMutationWithClient(prisma, {
      productId: row.id,
      expectedCatalogVersion: row.catalogVersion.toString(),
      changeDomains: ["PRICE"],
      async mutateAndSnapshot(tx, nextCatalogVersion) {
        const canonicalPrice = { priceUsd, priceEur: null, priceEurEurope: null, priceUah: null };
        await tx.shopProduct.update({ where: { id: row.id }, data: canonicalPrice });
        const variants = await tx.shopProductVariant.updateMany({ where: { productId: row.id, id: { in: row.variantIds } }, data: canonicalPrice });
        if (variants.count !== row.variantIds.length) throw new Error(`Variant ownership changed for ${row.slug}`);
        return buildShopCatalogAdminSnapshot(tx, row.id, nextCatalogVersion, { type: "IMPORT", id: "eventuri-warehouse-prices@system.local", reason: "eventuri.warehouse-price.correct" });
      },
    });
  }

  const publication = await runShopCatalogOutboxRuntime({ workerId: `eventuri-warehouse-price-cli:${process.pid}`, limit: 20 });
  console.log(JSON.stringify({ updated: updates.length, published: publication.completed }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
