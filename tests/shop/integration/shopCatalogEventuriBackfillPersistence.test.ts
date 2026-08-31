import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { buildEventuriSourceRecordDraft, type EventuriSnapshotProduct } from "../../../src/lib/shopCatalogEventuriNormalization";

const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const backfillModule = import("../../../src/lib/shopCatalogEventuriBackfill.server");

function snapshot(input: { productId: string; variantId: string; sku: string; slug: string; title: string; tags: string[] }): EventuriSnapshotProduct {
  return {
    id: input.productId, slug: input.slug, sku: input.sku, scope: "SHOP", brand: "Eventuri",
    title: { ua: input.title, en: input.title }, tags: ["Eventuri", ...input.tags, "store:main"], gallery: [],
    variants: [{ id: input.variantId, sku: input.sku, isDefault: true }],
  };
}
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({ data: {
    id: productId, slug: productId, titleUa: productId, titleEn: productId,
    variants: { create: { id: variantId, title: "Default", sku, isDefault: true } },
  } });
}

test("Eventuri backfill persists mixed per-SKU policies without broadening unknown engines", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = Date.now().toString();
  const { persistEventuriSourceRecordPageWithClient } = await backfillModule;
  try {
    const exactProduct = `eventuri-exact-${suffix}`, exactVariant = `${exactProduct}-variant`, exactSku = `EVE-EXACT-${suffix}`;
    await createProduct(client, exactProduct, exactVariant, exactSku);
    const exactDraft = buildEventuriSourceRecordDraft({
      product: snapshot({ productId: exactProduct, variantId: exactVariant, sku: exactSku, slug: "g8x-m3-m4-s58-intake", title: "BMW M3 M4 S58 Intake", tags: ["category:intake", "BMW", "M3", "G80", "G81", "M4", "G82", "G83", "S58"] }),
      sourceRevision: "eventuri-exact-v1",
    });
    const exactResult = await persistEventuriSourceRecordPageWithClient(client, { sourceKey: `eventuri-exact-${suffix}`, drafts: [exactDraft] });
    const exactPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
      where: { targetKey: `variant:${exactVariant}`, isActive: true },
      include: { clauses: { include: { constraints: { include: { values: true } } } }, dimensionRules: true },
    });
    assert.equal(exactPolicy.mode, "VEHICLE_SPECIFIC");
    assert.equal(exactPolicy.clauses.length, 4);
    assert.equal(exactPolicy.dimensionRules.length, 13);
    for (const clause of exactPolicy.clauses) {
      assert.equal(clause.constraints.length, 13);
      assert.ok(clause.constraints.find((entry) => entry.dimension === "ENGINE")?.values[0]?.powertrainId);
      assert.equal(clause.constraints.find((entry) => entry.dimension === "FUEL")?.values[0]?.textValue, "petrol");
    }
    assert.equal(await client.vehicleTaxonomyAlias.count({ where: { sourceId: exactResult.sourceId } }), 8);

    const universalProduct = `eventuri-universal-${suffix}`, universalVariant = `${universalProduct}-variant`, universalSku = `EVE-UNI-${suffix}`;
    await createProduct(client, universalProduct, universalVariant, universalSku);
    const universalDraft = buildEventuriSourceRecordDraft({
      product: snapshot({ productId: universalProduct, variantId: universalVariant, sku: universalSku, slug: "air-filter-cleaning-kit", title: "Air Filter Cleaning Kit", tags: ["category:filter-accessory"] }),
      sourceRevision: "eventuri-universal-v1",
    });
    await persistEventuriSourceRecordPageWithClient(client, { sourceKey: `eventuri-universal-${suffix}`, drafts: [universalDraft] });
    const universalPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
      where: { targetKey: `variant:${universalVariant}`, isActive: true },
      include: { clauses: { include: { constraints: true } } },
    });
    assert.equal(universalPolicy.mode, "UNIVERSAL");
    assert.equal(universalPolicy.clauses.length, 1);
    assert.equal(universalPolicy.clauses[0]?.constraints.length, 13);
    assert.equal(universalPolicy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "NOT_APPLICABLE");

    const reviewProduct = `eventuri-review-${suffix}`, reviewVariant = `${reviewProduct}-variant`, reviewSku = `EVE-REVIEW-${suffix}`;
    await createProduct(client, reviewProduct, reviewVariant, reviewSku);
    const reviewDraft = buildEventuriSourceRecordDraft({
      product: snapshot({ productId: reviewProduct, variantId: reviewVariant, sku: reviewSku, slug: "f87-m2-intake", title: "BMW F87 M2 Intake", tags: ["category:intake", "BMW", "M2", "F87"] }),
      sourceRevision: "eventuri-review-v1",
    });
    await persistEventuriSourceRecordPageWithClient(client, { sourceKey: `eventuri-review-${suffix}`, drafts: [reviewDraft] });
    const reviewPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
      where: { targetKey: `variant:${reviewVariant}`, isActive: true }, include: { clauses: { include: { constraints: true } } },
    });
    assert.equal(reviewPolicy.mode, "NEEDS_REVIEW");
    assert.equal(reviewPolicy.clauses[0]?.verification, "NEEDS_REVIEW");
    assert.equal(reviewPolicy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN");
  } finally { await client.$disconnect(); }
});
