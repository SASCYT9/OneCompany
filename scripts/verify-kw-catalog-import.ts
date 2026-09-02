import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { buildKwCanonicalProductDraft } from "../src/lib/shopCatalogKwDraft";
import { buildKwVehicleMakeEvidence, normalizeKwShopifyProduct } from "../src/lib/shopCatalogKwNormalization";
import { parseShopifyProductJsonl, parseShopifyProductTranslationMap, selectKwShopifyProducts } from "../src/lib/shopifyCatalogSnapshot";

const SNAPSHOT_DIR = resolve("backups/shopify/kw-suspensions/2026-09-02");
const PRODUCTS_PATH = resolve(SNAPSHOT_DIR, "products.jsonl");
const TRANSLATIONS_PATH = resolve(SNAPSHOT_DIR, "translations-en.jsonl");

function expectedCount() {
  const value = process.argv.find((argument) => argument.startsWith("--expected="))?.split("=")[1];
  return value ? Number.parseInt(value, 10) : 1_999;
}

async function main() {
  const expected = expectedCount();
  const activated = process.argv.includes("--activated");
  if (!Number.isInteger(expected) || expected < 1 || expected > 1_999) throw new TypeError("--expected must be between 1 and 1999");
  const products = selectKwShopifyProducts(parseShopifyProductJsonl(await readFile(PRODUCTS_PATH, "utf8"))).slice(0, expected);
  const translations = parseShopifyProductTranslationMap(await readFile(TRANSLATIONS_PATH, "utf8"));
  const evidence = buildKwVehicleMakeEvidence(products);
  const drafts = products.map((product) => buildKwCanonicalProductDraft({
    product,
    normalization: normalizeKwShopifyProduct(product, evidence),
    enTranslations: translations.get(product.id),
  }));
  const expectedTotals = {
    products: drafts.length,
    variants: drafts.reduce((sum, draft) => sum + draft.variants.length, 0),
    media: drafts.reduce((sum, draft) => sum + draft.media.length, 0),
    metafields: drafts.reduce((sum, draft) => sum + draft.metafields.length, 0),
  };
  const prisma = new PrismaClient();
  try {
    const source = await prisma.shopCatalogSource.findUniqueOrThrow({ where: { key: "shopify-kw-suspensions" } });
    const brand = await prisma.shopBrand.findUniqueOrThrow({ where: { key: "kw-suspensions" } });
    const productWhere = { brandId: brand.id };
    const [productsCount, variants, media, metafields, unpublished, versionZero, sourceRecords, productBindings, variantBindings, productHeads, variantHeads, provenance, issues, stProducts, categoryReviewProducts, fitmentMetafields, issueGroups] = await Promise.all([
      prisma.shopProduct.count({ where: productWhere }),
      prisma.shopProductVariant.count({ where: { product: productWhere } }),
      prisma.shopProductMedia.count({ where: { product: productWhere } }),
      prisma.shopProductMetafield.count({ where: { product: productWhere } }),
      prisma.shopProduct.count({ where: { ...productWhere, isPublished: false } }),
      prisma.shopProduct.count({ where: { ...productWhere, catalogVersion: 0 } }),
      prisma.shopCatalogSourceRecord.count({ where: { sourceId: source.id } }),
      prisma.shopCatalogSourceBinding.count({ where: { sourceId: source.id, entityType: "PRODUCT" } }),
      prisma.shopCatalogSourceBinding.count({ where: { sourceId: source.id, entityType: "VARIANT" } }),
      prisma.shopCatalogSourceBindingHead.count({ where: { sourceId: source.id, entityType: "PRODUCT" } }),
      prisma.shopCatalogSourceBindingHead.count({ where: { sourceId: source.id, entityType: "VARIANT" } }),
      prisma.shopCatalogFieldProvenance.count({ where: { sourceRecord: { sourceId: source.id } } }),
      prisma.shopCatalogNormalizationIssue.count({ where: { sourceRecord: { sourceId: source.id } } }),
      prisma.shopProduct.count({ where: { ...productWhere, OR: [{ vendor: { equals: "ST", mode: "insensitive" } }, { brand: { equals: "ST", mode: "insensitive" } }] } }),
      prisma.shopProduct.count({ where: { ...productWhere, category: { slug: "needs-review" } } }),
      prisma.shopProductMetafield.findMany({ where: { product: productWhere, namespace: "onecompany", key: "normalized_fitment" }, select: { value: true } }),
      prisma.shopCatalogNormalizationIssue.groupBy({ by: ["code"], where: { sourceRecord: { sourceId: source.id } }, _count: true }),
    ]);
    const fitmentStatuses = fitmentMetafields.reduce<Record<string, number>>((counts, metafield) => {
      const status = String((JSON.parse(metafield.value) as { status?: unknown }).status ?? "missing");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const actual = { products: productsCount, variants, media, metafields };
    const checks = {
      exactEntityParity: JSON.stringify(actual) === JSON.stringify(expectedTotals),
      exactSourceRecords: sourceRecords === expected,
      exactBindings: productBindings === expected && productHeads === expected && variantBindings === expectedTotals.variants && variantHeads === expectedTotals.variants,
      publicationState: activated ? unpublished === 0 : unpublished === expected,
      catalogVersionState: activated ? versionZero === 0 : versionZero === expected,
      rawFieldProvenancePresent: provenance > 0,
      noStProducts: stProducts === 0,
      allCategoriesMapped: categoryReviewProducts === 0,
      fitmentProjectionReady: Object.values(fitmentStatuses).reduce((sum, count) => sum + count, 0) === expected,
    };
    const report = { expected: expectedTotals, actual, sourceRecords, bindings: { productBindings, variantBindings, productHeads, variantHeads }, unpublished, versionZero, provenance, issues, issueCounts: Object.fromEntries(issueGroups.map((group) => [group.code, group._count])), stProducts, categoryReviewProducts, fitmentStatuses, checks, passed: Object.values(checks).every(Boolean) };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
