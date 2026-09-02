import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { buildKwVehicleMakeEvidence, normalizeKwShopifyProduct } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, parseShopifyProductTranslationMap, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

const SNAPSHOT_DIR = resolve("backups/shopify/kw-suspensions/2026-09-02");

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
      if (!["P1017", "P2024", "P2034"].includes(String(code)) || attempt === 5) throw error;
      await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 250));
    }
  }
  throw new Error("KW reconciliation retry loop exhausted");
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  const products = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(resolve(SNAPSHOT_DIR, "products.jsonl"), "utf8")));
  const translations = parseShopifyProductTranslationMap(await readFile(resolve(SNAPSHOT_DIR, "translations-en.jsonl"), "utf8"));
  const evidence = buildKwVehicleMakeEvidence(products);
  const drafts = products.map((product) => buildKwCanonicalProductDraft({ product, normalization: normalizeKwShopifyProduct(product, evidence), enTranslations: translations.get(product.id) }));
  const report = {
    mode: commit ? "commit-draft" : "dry-run",
    selected: drafts.length,
    projectionReady: drafts.filter((draft) => !draft.normalization.issues.includes("vehicle_make_correlation_ambiguous")).length,
    categoryReview: drafts.filter((draft) => draft.normalization.categoryKey === "needs-review").length,
    published: 0,
  };
  if (!commit) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-kw-suspensions" } });
    const [heads, categories] = await Promise.all([
      prisma.shopCatalogSourceBindingHead.findMany({
        where: { sourceId: source.id, entityType: "PRODUCT" },
        select: { externalKey: true, currentBinding: { select: { productId: true, sourceRecordId: true } } },
      }),
      prisma.shopCategory.findMany({ select: { id: true, slug: true } }),
    ]);
    const ownership = new Map(heads.map((head) => [head.externalKey, head.currentBinding]));
    const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
    let updated = 0;
    for (let offset = 0; offset < drafts.length; offset += 2) {
      await Promise.all(drafts.slice(offset, offset + 2).map(async (draft) => {
        const binding = ownership.get(draft.source.externalProductId);
        const categoryId = categoryIds.get(draft.normalization.categoryKey);
        const normalizedFitment = draft.metafields.find((field) => field.namespace === "onecompany" && field.key === "normalized_fitment");
        if (!binding?.productId || !binding.sourceRecordId || !categoryId || !normalizedFitment) throw new Error(`Incomplete KW ownership for ${draft.source.externalProductId}`);
        await retryTransient(() => prisma.$transaction(async (tx) => {
          await tx.shopProduct.update({ where: { id: binding.productId! }, data: { categoryId, productCategory: draft.normalization.categoryKey } });
          await tx.shopProductMetafield.update({
            where: { productId_namespace_key: { productId: binding.productId!, namespace: "onecompany", key: "normalized_fitment" } },
            data: { value: normalizedFitment.value, valueType: "json" },
          });
          await tx.shopCatalogNormalizationIssue.deleteMany({ where: { sourceRecordId: binding.sourceRecordId! } });
          if (draft.issues.length) await tx.shopCatalogNormalizationIssue.createMany({ data: draft.issues.map((issue) => ({
            sourceRecordId: binding.sourceRecordId!, productId: binding.productId!, issueKey: `kw:${issue}`,
            code: issue.toUpperCase(), rawPath: "$", details: { externalProductId: draft.source.externalProductId, sku: draft.product.sku } as Prisma.InputJsonValue,
          })) });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }));
        updated += 1;
      }));
      if (updated % 200 === 0) process.stdout.write(`${JSON.stringify({ updated })}\n`);
    }
    process.stdout.write(`${JSON.stringify({ ...report, updated }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
