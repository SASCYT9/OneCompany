import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  buildAdroSourceRecordDraft,
  type AdroSnapshotProduct,
} from "../../../src/lib/shopCatalogAdroNormalization";

const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const backfillModule = import("../../../src/lib/shopCatalogAdroBackfill.server");
const reportModule = import("../../../src/lib/shopCatalogSourceCoverageReport.server");

function snapshot(input: { productId: string; variantId: string; sku: string; title: string }): AdroSnapshotProduct {
  return {
    id: input.productId,
    slug: input.productId,
    sku: input.sku,
    scope: "SHOP",
    brand: "ADRO",
    title: { ua: input.title, en: input.title },
    gallery: [],
    tags: [],
    variants: [{ id: input.variantId, sku: input.sku, isDefault: true }],
  };
}

async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({
    data: {
      id: productId,
      slug: productId,
      titleUa: productId,
      titleEn: productId,
      variants: { create: { id: variantId, title: "Default", sku, isDefault: true } },
    },
  });
}

test(
  "ADRO backfill persists correlated clauses and explicit aero non-applicability",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = Date.now().toString();
    const productId = `adro-backfill-product-${suffix}`;
    const variantId = `adro-backfill-variant-${suffix}`;
    const sku = `ADRO-${suffix}`;
    const sourceKey = `adro-backfill-${suffix}`;
    try {
      await createProduct(client, productId, variantId, sku);
      const draft = buildAdroSourceRecordDraft({
        product: snapshot({
          productId,
          variantId,
          sku,
          title: "ADRO aero for BMW M3 (G80 / G81) / M4 (G82 / G83) 2021+",
        }),
        sourceRevision: "adro-v1",
      });
      assert.equal(draft.normalization.verification, "VERIFIED");
      const { persistAdroSourceRecordPageWithClient } = await backfillModule;
      const first = await persistAdroSourceRecordPageWithClient(client, { sourceKey, drafts: [draft] });
      assert.equal(first.inserted, 1);
      assert.equal(first.provenanceInserted, draft.provenance.length);
      const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `variant:${variantId}`, isActive: true },
        include: {
          dimensionRules: true,
          clauses: { include: { constraints: { include: { values: true } } } },
        },
      });
      assert.equal(policy.mode, "VEHICLE_SPECIFIC");
      assert.equal(policy.dimensionRules.length, 13);
      assert.equal(policy.clauses.length, 4);
      assert.ok(policy.clauses.every((clause) => clause.verification === "VERIFIED"));
      for (const clause of policy.clauses) {
        assert.equal(clause.constraints.length, 13);
        assert.equal(clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "NOT_APPLICABLE");
        assert.equal(clause.constraints.find((entry) => entry.dimension === "FUEL")?.state, "NOT_APPLICABLE");
        assert.equal(clause.constraints.find((entry) => entry.dimension === "CHASSIS")?.state, "EXACT");
      }
      assert.equal(await client.vehicleTaxonomyAlias.count({ where: { sourceId: first.sourceId } }), 7);
      const replay = await persistAdroSourceRecordPageWithClient(client, { sourceKey, drafts: [draft] });
      assert.equal(replay.idempotent, 1);
      assert.equal(
        await client.shopCatalogCompatibilityPolicy.count({ where: { targetKey: `variant:${variantId}` } }),
        1
      );
      const { readShopCatalogSourceCoveragePage } = await reportModule;
      const coverage = await readShopCatalogSourceCoveragePage(client, { sourceKey });
      assert.equal(coverage?.records[0]?.activationReady, true);

      const reviewProductId = `${productId}-review`;
      const reviewVariantId = `${variantId}-review`;
      const reviewSku = `${sku}-REVIEW`;
      await createProduct(client, reviewProductId, reviewVariantId, reviewSku);
      const reviewDraft = buildAdroSourceRecordDraft({
        product: snapshot({
          productId: reviewProductId,
          variantId: reviewVariantId,
          sku: reviewSku,
          title: "ADRO wing for TOYOTA GR86 / SUBARU BRZ 2022- / BMW M2 (F87)",
        }),
        sourceRevision: "adro-review-v1",
      });
      await persistAdroSourceRecordPageWithClient(client, {
        sourceKey: `${sourceKey}-review`,
        drafts: [reviewDraft],
      });
      const reviewPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `variant:${reviewVariantId}`, isActive: true },
        include: { clauses: true },
      });
      assert.equal(reviewPolicy.mode, "NEEDS_REVIEW");
      assert.equal(reviewPolicy.clauses.length, 3);
      assert.ok(reviewPolicy.clauses.every((clause) => clause.verification === "NEEDS_REVIEW"));
    } finally {
      await client.$disconnect();
    }
  }
);
