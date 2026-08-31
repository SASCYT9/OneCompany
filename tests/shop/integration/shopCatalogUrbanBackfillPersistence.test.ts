import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildUrbanSourceRecordDraft, type UrbanSnapshotProduct } from "../../../src/lib/shopCatalogUrbanNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogUrbanBackfill.server");
function snapshot(input: { productId: string; variantId: string; sku: string; title: string; tags: string[] }): UrbanSnapshotProduct {
  return { id: input.productId, slug: input.productId, sku: input.sku, scope: "SHOP", title: { ua: input.title, en: input.title }, tags: input.tags,
    gallery: [], variants: [{ id: input.variantId, sku: input.sku, isDefault: true }] };
}
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId,
    variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } });
}
test("Urban backfill persists correlated multi-chassis wheels and review-only exhaust", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString();
  const { persistUrbanSourceRecordPageWithClient } = await backfillModule;
  try {
    const productId = `urban-wheel-${suffix}`, variantId = `${productId}-variant`, sku = `URB-WHEEL-${suffix}`;
    await createProduct(client, productId, variantId, sku);
    const draft = buildUrbanSourceRecordDraft({ product: snapshot({ productId, variantId, sku, title: '24" Urban wheel (L405/L494)', tags: ["urban-family:wheels", "urban-vehicle-brand:range-rover", "fits-model:range-rover:24-uc9"] }), sourceRevision: "urban-v1" });
    const result = await persistUrbanSourceRecordPageWithClient(client, { sourceKey: `urban-${suffix}`, drafts: [draft] });
    const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}`, isActive: true }, include: { clauses: { include: { constraints: { include: { values: true } } } } } });
    assert.equal(policy.mode, "VEHICLE_SPECIFIC"); assert.equal(policy.clauses.length, 2);
    assert.deepEqual(policy.clauses.map((clause) => clause.constraints.find((entry) => entry.dimension === "CHASSIS")?.values[0]?.textValue).sort(), ["L405", "L494"]);
    assert.ok(policy.clauses.every((clause) => clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state === "NOT_APPLICABLE"));
    assert.equal(await client.vehicleTaxonomyAlias.count({ where: { sourceId: result.sourceId } }), 5);

    const reviewProduct = `urban-exhaust-${suffix}`, reviewVariant = `${reviewProduct}-variant`, reviewSku = `URB-EXH-${suffix}`;
    await createProduct(client, reviewProduct, reviewVariant, reviewSku);
    const reviewDraft = buildUrbanSourceRecordDraft({ product: snapshot({ productId: reviewProduct, variantId: reviewVariant, sku: reviewSku, title: "Bentley Continental GT exhaust", tags: ["urban-family:exhaust", "urban-vehicle-brand:bentley"] }), sourceRevision: "urban-review-v1" });
    await persistUrbanSourceRecordPageWithClient(client, { sourceKey: `urban-review-${suffix}`, drafts: [reviewDraft] });
    const review = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${reviewVariant}` }, include: { clauses: { include: { constraints: true } } } });
    assert.equal(review.mode, "NEEDS_REVIEW"); assert.equal(review.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN");
  } finally { await client.$disconnect(); }
});
