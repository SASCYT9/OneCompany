import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { buildKwVehicleMakeEvidence, normalizeKwShopifyProduct } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, parseShopifyProductTranslationMap, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

function chunks<T>(values: readonly T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function main() {
  const productPath = process.argv[2];
  const translationPath = process.argv[3];
  if (!productPath || !translationPath) {
    throw new TypeError("Usage: tsx scripts/preflight-kw-database-import.ts <products.jsonl> <translations-en.jsonl> [report.json]");
  }
  const outputPath = process.argv[4] ?? `${productPath}.kw-database-preflight.json`;
  const products = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(resolve(productPath), "utf8")));
  const translations = parseShopifyProductTranslationMap(await readFile(resolve(translationPath), "utf8"));
  const evidence = buildKwVehicleMakeEvidence(products);
  const drafts = products.map((product) => buildKwCanonicalProductDraft({
    product,
    normalization: normalizeKwShopifyProduct(product, evidence),
    enTranslations: translations.get(product.id),
  }));
  const prisma = new PrismaClient();
  try {
    const slugCollisions = [];
    for (const page of chunks(drafts.map((draft) => draft.product.slug), 500)) {
      slugCollisions.push(...await prisma.shopProduct.findMany({ where: { slug: { in: page } }, select: { id: true, slug: true, sku: true } }));
    }
    const skuCollisions = [];
    const skus = drafts.flatMap((draft) => draft.variants.map((variant) => variant.sku).filter((sku): sku is string => Boolean(sku)));
    for (const page of chunks(skus, 500)) {
      skuCollisions.push(...await prisma.shopProductVariant.findMany({ where: { sku: { in: page } }, select: { id: true, productId: true, sku: true } }));
    }
    const source = await prisma.shopCatalogSource.findUnique({
      where: { key: "shopify-kw-suspensions" },
      select: { id: true, _count: { select: { records: true, bindings: true, bindingHeads: true } } },
    });
    const report = {
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      drafts: drafts.length,
      variants: drafts.reduce((count, draft) => count + draft.variants.length, 0),
      slugCollisions,
      skuCollisions,
      existingSource: source,
      existingCanonicalKwProducts: await prisma.shopProduct.count({
        where: { OR: [{ brand: "KW Suspensions" }, { vendor: "KW Suspensions" }] },
      }),
      currentCatalogProducts: await prisma.shopProduct.count(),
      readyForFirstInsert: slugCollisions.length === 0 && skuCollisions.length === 0 && !source,
    };
    await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
