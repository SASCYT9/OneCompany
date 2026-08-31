import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildBrabusSourceRecordDraft, type BrabusSnapshotProduct } from "../../../src/lib/shopCatalogBrabusNormalization";

const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogBrabusBackfill.server");

function snapshot(input: { productId: string; variantId: string; sku: string; title: string; tags: string[] }): BrabusSnapshotProduct {
  return { id: input.productId, slug: input.productId, sku: input.sku, scope: "SHOP", title: { ua: input.title, en: input.title }, tags: input.tags,
    gallery: [], variants: [{ id: input.variantId, sku: input.sku, isDefault: true }] };
}
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId,
    variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } });
}

test("Brabus backfill persists exact chassis and quarantines missing engine identity", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = Date.now().toString();
  const { persistBrabusSourceRecordPageWithClient } = await backfillModule;
  try {
    const productId = `brabus-exact-${suffix}`, variantId = `${productId}-variant`, sku = `BRABUS-${suffix}`;
    await createProduct(client, productId, variantId, sku);
    const exactDraft = buildBrabusSourceRecordDraft({ product: snapshot({ productId, variantId, sku,
      title: "Carbon parts for Mercedes – X 167 – Maybach GLS 600", tags: ["fits-make:mercedes-benz", "fits-model:mercedes-benz:gls"] }), sourceRevision: "brabus-v1" });
    const result = await persistBrabusSourceRecordPageWithClient(client, { sourceKey: `brabus-${suffix}`, drafts: [exactDraft] });
    const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}`, isActive: true },
      include: { clauses: { include: { constraints: { include: { values: true } } } }, dimensionRules: true } });
    assert.equal(policy.mode, "VEHICLE_SPECIFIC");
    assert.equal(policy.dimensionRules.length, 13);
    assert.equal(policy.clauses.length, 1);
    assert.equal(policy.clauses[0]?.constraints.length, 13);
    assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "CHASSIS")?.values[0]?.textValue, "X167");
    assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "NOT_APPLICABLE");
    assert.equal(await client.vehicleTaxonomyAlias.count({ where: { sourceId: result.sourceId } }), 3);

    const reviewProduct = `brabus-review-${suffix}`, reviewVariant = `${reviewProduct}-variant`, reviewSku = `BRABUS-REVIEW-${suffix}`;
    await createProduct(client, reviewProduct, reviewVariant, reviewSku);
    const reviewDraft = buildBrabusSourceRecordDraft({ product: snapshot({ productId: reviewProduct, variantId: reviewVariant, sku: reviewSku,
      title: "PowerXtra B40S-800 for Mercedes – X 167 – Maybach GLS 600", tags: ["fits-make:mercedes-benz"] }), sourceRevision: "brabus-review-v1" });
    await persistBrabusSourceRecordPageWithClient(client, { sourceKey: `brabus-review-${suffix}`, drafts: [reviewDraft] });
    const reviewPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${reviewVariant}`, isActive: true },
      include: { clauses: { include: { constraints: true } } } });
    assert.equal(reviewPolicy.mode, "NEEDS_REVIEW");
    assert.equal(reviewPolicy.clauses[0]?.verification, "NEEDS_REVIEW");
    assert.equal(reviewPolicy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN");
  } finally { await client.$disconnect(); }
});
