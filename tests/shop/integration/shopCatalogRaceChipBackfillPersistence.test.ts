import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { buildRaceChipSourceRecordDraft } from "../../../src/lib/shopCatalogRaceChipNormalization";

const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const backfillModule = import("../../../src/lib/shopCatalogRaceChipBackfill.server");
const reportModule = import("../../../src/lib/shopCatalogSourceCoverageReport.server");

function snapshot(productId: string, variantId: string, title = "RaceChip test") {
  return {
    id: productId,
    slug: productId,
    sku: "RC-GTS5-AUDI-2-0-TFSI",
    scope: "SHOP",
    title: { ua: title, en: title },
    gallery: [],
    tags: [
      "car_make:audi",
      "car_model:a4-b9-from-2015",
      "car_engine:2-0-tfsi-1984ccm-190hp-140kw-320nm",
      "ccm:1984",
      "base_hp:190",
      "gain_hp:45",
      "gain_nm:70",
      "fits-make:audi",
      "fits-model:audi:a4",
      "fits-trim:audi:a4:b9",
    ],
    variants: [{ id: variantId, sku: "RC-GTS5-AUDI-2-0-TFSI-AC", isDefault: true }],
  };
}

test(
  "RaceChip backfill is transactional, lossless, append-only, and idempotent",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = Date.now().toString();
    const productId = `racechip-backfill-product-${suffix}`;
    const variantId = `racechip-backfill-variant-${suffix}`;
    const sourceKey = `racechip-backfill-${suffix}`;
    try {
      await client.shopProduct.create({
        data: {
          id: productId,
          slug: productId,
          titleUa: productId,
          titleEn: productId,
          variants: {
            create: { id: variantId, title: "Default", sku: `RC-TEST-${suffix}`, isDefault: true },
          },
        },
      });
      const draftV1 = buildRaceChipSourceRecordDraft({
        product: snapshot(productId, variantId),
        sourceRevision: "shard-v1",
      });
      const { persistRaceChipSourceRecordPageWithClient } = await backfillModule;
      const first = await persistRaceChipSourceRecordPageWithClient(client, {
        sourceKey,
        drafts: [draftV1],
      });
      assert.equal(first.inserted, 1);
      assert.equal(first.provenanceInserted, draftV1.provenance.length);
      assert.equal(first.issuesInserted, 0);
      const policyV1 = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `variant:${variantId}`, isActive: true },
        include: {
          dimensionRules: true,
          clauses: { include: { constraints: { include: { values: true } } } },
        },
      });
      assert.equal(policyV1.mode, "VEHICLE_SPECIFIC");
      assert.equal(policyV1.revision, 1);
      assert.equal(policyV1.dimensionRules.length, 13);
      assert.equal(policyV1.clauses.length, 1);
      assert.equal(policyV1.clauses[0]?.verification, "VERIFIED");
      assert.equal(policyV1.clauses[0]?.constraints.length, 13);
      const engineV1 = policyV1.clauses[0]?.constraints.find(
        (constraint) => constraint.dimension === "ENGINE"
      );
      assert.equal(engineV1?.state, "EXACT");
      assert.ok(engineV1?.values[0]?.powertrainId);
      assert.equal(engineV1?.values[0]?.textValue, null);
      assert.equal(
        await client.vehicleTaxonomyAlias.count({ where: { sourceId: first.sourceId } }),
        5
      );
      const replay = await persistRaceChipSourceRecordPageWithClient(client, {
        sourceKey,
        drafts: [draftV1],
      });
      assert.equal(replay.inserted, 0);
      assert.equal(replay.idempotent, 1);

      const { readShopCatalogSourceCoveragePage } = await reportModule;
      const coverageV1 = await readShopCatalogSourceCoveragePage(client, { sourceKey });
      assert.equal(coverageV1?.records.length, 1);
      assert.equal(coverageV1?.records[0]?.coveragePercent, 100);
      assert.equal(coverageV1?.records[0]?.activationReady, true);

      const draftV2 = buildRaceChipSourceRecordDraft({
        product: snapshot(productId, variantId, "RaceChip revised"),
        sourceRevision: "shard-v2",
      });
      const second = await persistRaceChipSourceRecordPageWithClient(client, {
        sourceKey,
        drafts: [draftV2],
        reviewedById: "integration-reviewer",
      });
      assert.equal(second.inserted, 1);
      const policies = await client.shopCatalogCompatibilityPolicy.findMany({
        where: { targetKey: `variant:${variantId}` },
        orderBy: { revision: "asc" },
      });
      assert.equal(policies.length, 2);
      assert.equal(policies[0]?.isActive, false);
      assert.ok(policies[0]?.retiredAt);
      assert.equal(policies[1]?.revision, 2);
      assert.equal(policies[1]?.isActive, true);
      const source = await client.shopCatalogSource.findUniqueOrThrow({ where: { key: sourceKey } });
      const records = await client.shopCatalogSourceRecord.findMany({
        where: { sourceId: source.id },
        include: { supersededBy: true },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(records.length, 2);
      assert.equal(records[0]?.supersededBy?.sourceRevision, "shard-v2");
      assert.equal(policies[1]?.sourceRecordId, records[1]?.id);
      const head = await client.shopCatalogSourceBindingHead.findUniqueOrThrow({
        where: {
          sourceId_entityType_externalKey: {
            sourceId: source.id,
            entityType: "VARIANT",
            externalKey: draftV1.sourceRecord.recordKey,
          },
        },
        include: { currentBinding: true },
      });
      assert.equal(head.currentBinding.bindingVersion, 2);
      assert.equal(head.currentBinding.sourceRecordId, records[1]?.id);
      const currentCoverage = await readShopCatalogSourceCoveragePage(client, { sourceKey });
      assert.equal(currentCoverage?.records.length, 1);
      assert.equal(currentCoverage?.records[0]?.sourceRevision, "shard-v2");

      const conflicting = structuredClone(draftV2);
      conflicting.sourceRecord.payloadHash = "f".repeat(64);
      await assert.rejects(
        persistRaceChipSourceRecordPageWithClient(client, {
          sourceKey,
          drafts: [conflicting],
          reviewedById: "integration-reviewer",
        }),
        /immutable replay conflict/
      );

      const reviewProductId = `${productId}-review`;
      const reviewVariantId = `${variantId}-review`;
      await client.shopProduct.create({
        data: {
          id: reviewProductId,
          slug: reviewProductId,
          titleUa: reviewProductId,
          titleEn: reviewProductId,
          variants: {
            create: {
              id: reviewVariantId,
              title: "Default",
              sku: `RC-REVIEW-${suffix}`,
              isDefault: true,
            },
          },
        },
      });
      const reviewSnapshot = snapshot(reviewProductId, reviewVariantId);
      reviewSnapshot.tags = reviewSnapshot.tags.map((tag) =>
        tag.startsWith("car_engine:") ? "car_engine:2-0-1984ccm-190hp-140kw-320nm" : tag
      );
      const reviewDraft = buildRaceChipSourceRecordDraft({
        product: reviewSnapshot,
        sourceRevision: "shard-review",
      });
      assert.equal(reviewDraft.normalization.verification, "NEEDS_REVIEW");
      await persistRaceChipSourceRecordPageWithClient(client, {
        sourceKey: `${sourceKey}-review`,
        drafts: [reviewDraft],
      });
      const reviewPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `variant:${reviewVariantId}`, isActive: true },
        include: { clauses: { include: { constraints: true } } },
      });
      assert.equal(reviewPolicy.mode, "NEEDS_REVIEW");
      assert.equal(reviewPolicy.clauses[0]?.verification, "NEEDS_REVIEW");
      assert.equal(
        reviewPolicy.clauses[0]?.constraints.find((constraint) => constraint.dimension === "FUEL")
          ?.state,
        "UNKNOWN"
      );
    } finally {
      await client.$disconnect();
    }
  }
);
