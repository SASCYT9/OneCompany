import { Prisma } from "@prisma/client";

import { getShopProductsServer } from "../src/lib/shopCatalogServer";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
} from "../src/lib/shopFitmentQuality";
import { prisma } from "../src/lib/prisma";
import { buildShopProductKnowledge } from "../src/lib/shopProductKnowledge";

type SyncStats = {
  scanned: number;
  valid: number;
  unchanged: number;
  created: number;
  updated: number;
  skipped: number;
};

function parseLimit(argv: string[]) {
  const raw = argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1];
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error("--limit must be a positive integer");
  return value;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const limit = parseLimit(process.argv.slice(2));
  const [allProducts, fitmentOverrides, existingRows] = await Promise.all([
    getShopProductsServer(),
    prisma.shopProductMetafield.findMany({
      where: {
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: NORMALIZED_FITMENT_KEY,
      },
      select: { productId: true, value: true },
    }),
    prisma.shopProductKnowledge.findMany({
      select: { productId: true, contentHash: true },
    }),
  ]);
  const products = limit ? allProducts.slice(0, limit) : allProducts;
  const overrideByProductId = new Map(
    fitmentOverrides.map((item) => [item.productId, item.value] as const)
  );
  const existingByProductId = new Map(
    existingRows.map((item) => [item.productId, item.contentHash] as const)
  );
  const stats: SyncStats = {
    scanned: products.length,
    valid: 0,
    unchanged: 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const product of products) {
    const knowledge = buildShopProductKnowledge(
      product,
      product.id ? overrideByProductId.get(product.id) : null
    );
    if (!knowledge) {
      stats.skipped += 1;
      continue;
    }
    stats.valid += 1;
    const previousHash = existingByProductId.get(knowledge.productId);
    if (previousHash === knowledge.contentHash) {
      stats.unchanged += 1;
      continue;
    }
    if (previousHash) stats.updated += 1;
    else stats.created += 1;
    if (!commit) continue;

    const data = {
      schemaVersion: knowledge.schemaVersion,
      vehicleType: knowledge.vehicleType,
      makes: knowledge.makes,
      models: knowledge.models,
      chassisCodes: knowledge.chassisCodes,
      yearRanges: knowledge.yearRanges as Prisma.InputJsonValue,
      engines: knowledge.engines,
      bodyStyles: knowledge.bodyStyles,
      markets: knowledge.markets,
      categoryGroup: knowledge.categoryGroup,
      powerGainHp: knowledge.powerGainHp,
      torqueGainNm: knowledge.torqueGainNm,
      material: knowledge.material,
      opfGpf: knowledge.opfGpf,
      installationType: knowledge.installationType,
      fitmentStatus: knowledge.fitmentStatus,
      fitmentSource: knowledge.fitmentSource,
      applications: knowledge.applications as Prisma.InputJsonValue,
      facts: knowledge.facts as Prisma.InputJsonValue,
      searchText: knowledge.searchText,
      contentHash: knowledge.contentHash,
      embeddingModel: null,
      indexedAt: new Date(),
    };
    await prisma.shopProductKnowledge.upsert({
      where: { productId: knowledge.productId },
      create: { productId: knowledge.productId, ...data },
      update: data,
    });
    if (previousHash) {
      await prisma.$executeRaw`
        UPDATE "ShopProductKnowledge"
        SET "embedding" = NULL
        WHERE "productId" = ${knowledge.productId}
      `;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: commit ? "commit" : "dry-run",
        totalCatalogProducts: allProducts.length,
        limit,
        ...stats,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
