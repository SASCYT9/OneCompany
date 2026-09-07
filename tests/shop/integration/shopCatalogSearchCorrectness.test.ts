import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  auditLegacySnapshotCatalog,
  type CatalogSearchDiagnosticProduct,
} from "../../../src/lib/shopCatalogSearchCorrectnessDiagnostics";
import {
  buildBurgerSourceRecordDraft,
  normalizeBurgerSnapshotProduct,
  type BurgerSnapshotProduct,
} from "../../../src/lib/shopCatalogBurgerNormalization";
import {
  normalizeLegacyApplicationsToShopCatalogV2Policy,
  strictMatchShopCatalogV2Compatibility,
} from "../../../src/lib/shopCatalogV2Compatibility";
import type { ShopCatalogProjectionSource } from "../../../src/lib/shopCatalogProjection.server";

const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;

if (
  databaseUrl &&
  (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
    process.env.DATABASE_URL !== databaseUrl ||
    process.env.DIRECT_URL !== databaseUrl)
) {
  throw new Error(
    "Search correctness integration requires the explicitly disposable localhost database"
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const burgerBackfillModule = import("../../../src/lib/shopCatalogBurgerBackfill.server");
const eventuriBackfillModule = import("../../../src/lib/shopCatalogEventuriBackfill.server");
const eventuriNormalizationModule = import("../../../src/lib/shopCatalogEventuriNormalization");
const projectionModule = import("../../../src/lib/shopCatalogProjection.server");
const projectionPersistenceModule =
  import("../../../src/lib/shopCatalogProjectionPersistence.server");
const projectionQueryModule = import("../../../src/lib/shopCatalogProjectionQuery.server");

type Manifest = { stores: Record<string, { file: string }> };

const contaminatedSlugs = [
  "burger-jb4-for-kia-hyundai-genesis-v4",
  "burger-kia-genesis-bluetooth-flex-fuel-e85-kit-hi-flow",
  "burger-kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner",
  "burger-kia-stinger-genesis-g70-g90-4-bar-tmap-adapter-kit",
] as const;
const validSlug = "burger-s68-jb4-tuner-for-g90-bmw-m5";

async function burgerSnapshotProducts() {
  const root = path.resolve("public/catalog-fallback");
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as Manifest;
  const products = JSON.parse(
    await readFile(path.join(root, manifest.stores.burger!.file), "utf8")
  ) as BurgerSnapshotProduct[];
  const wanted = new Set([...contaminatedSlugs, validSlug]);
  const selected = products.filter((product) =>
    wanted.has(product.slug as (typeof contaminatedSlugs)[number])
  );
  assert.equal(
    selected.length,
    wanted.size,
    "the immutable Burger fixture set must remain available"
  );
  return selected;
}

function cloneSnapshot(product: BurgerSnapshotProduct, suffix: string): BurgerSnapshotProduct {
  const productId = `search-correctness-${suffix}-${product.slug}`;
  const defaultVariant = product.variants.find((variant) => variant.isDefault);
  assert.ok(defaultVariant?.sku, `${product.slug} needs one default SKU`);
  return {
    ...product,
    id: productId,
    slug: productId,
    sku: `${defaultVariant.sku}-${suffix}`,
    variants: [
      { id: `${productId}-variant`, sku: `${defaultVariant.sku}-${suffix}`, isDefault: true },
    ],
  };
}

async function createProduct(client: PrismaClient, product: BurgerSnapshotProduct) {
  const variant = product.variants[0]!;
  await client.shopProduct.create({
    data: {
      id: product.id,
      slug: product.slug,
      titleUa: product.title.ua,
      titleEn: product.title.en,
      brand: "Burger",
      isPublished: true,
      status: "ACTIVE",
      variants: { create: { id: variant.id, title: "Default", sku: variant.sku, isDefault: true } },
    },
  });
}

function policyForBurger(product: BurgerSnapshotProduct, includeEngine = true) {
  const normalized = normalizeBurgerSnapshotProduct(product);
  return normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId: product.id, variantId: normalized.variantId },
    mode: normalized.mode,
    requiredDimensions:
      normalized.mode === "VEHICLE_SPECIFIC"
        ? includeEngine
          ? ["make", "model", "engine"]
          : ["make", "model"]
        : [],
    verification: normalized.verification,
    scope: "auto",
    applications: normalized.applications.map((application) => ({
      make: application.make,
      model: application.model,
      generation: application.generation,
      chassis: application.generation,
      yearFrom: application.yearFrom,
      yearTo: application.yearTo,
      engine: includeEngine ? application.engineCode : null,
      scope: "auto",
    })),
  });
}

function projectionSource(
  product: BurgerSnapshotProduct,
  includeEngine = true
): ShopCatalogProjectionSource {
  const normalized = normalizeBurgerSnapshotProduct(product);
  return {
    productId: product.id,
    sourceVersion: "1",
    catalogVersion: "1",
    canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: { variants: 1, applications: 1 },
    slug: product.slug,
    sku: product.sku,
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "IN_STOCK",
    isPublished: true,
    stableRank: 1,
    brand: { key: "burger", labelUa: "Burger", labelEn: "Burger" },
    locales: { ua: { title: product.title.ua }, en: { title: product.title.en } },
    variants: [
      {
        variantId: normalized.variantId,
        sku: normalized.variantSku,
        isDefault: true,
        stableRank: 1,
      },
    ],
    compatibilityPolicies: [policyForBurger(product, includeEngine)],
    canonicalPowertrains: includeEngine
      ? [
          {
            variantId: normalized.variantId,
            clauseId: "application-1",
            code: "S68",
            powertrainId: "placeholder",
          },
        ]
      : [],
  };
}

test(
  "snapshot false BMW matches are excluded while verified source records survive canonical projection",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = Date.now().toString();
    const burgerSourceKey = `search-correctness-burger-${suffix}`;
    const eventuriSourceKey = `search-correctness-eventuri-${suffix}`;
    const productIds: string[] = [];
    try {
      const original = await burgerSnapshotProducts();
      const legacyReport = auditLegacySnapshotCatalog({
        stores: { burger: original as CatalogSearchDiagnosticProduct[] },
        query: { make: "BMW", model: "M5", chassis: "G90" },
      });
      assert.deepEqual(
        legacyReport.queryMatches.map((item) => item.slug).sort(),
        [...contaminatedSlugs, validSlug].sort()
      );
      assert.ok(
        legacyReport.queryMatches
          .filter((item) =>
            contaminatedSlugs.includes(item.slug as (typeof contaminatedSlugs)[number])
          )
          .every((item) => item.suspicious)
      );

      const fixtures = original.map((product) => cloneSnapshot(product, suffix));
      for (const product of fixtures) {
        productIds.push(product.id);
        await createProduct(client, product);
      }
      const valid = fixtures.find((product) => product.slug.endsWith(validSlug))!;
      const polluted = fixtures.filter((product) => !product.slug.endsWith(validSlug));
      const { persistBurgerSourceRecordPageWithClient } = await burgerBackfillModule;
      const drafts = fixtures
        .map((product) =>
          buildBurgerSourceRecordDraft({ product, sourceRevision: "snapshot-2026-09-03" })
        )
        .sort((left, right) =>
          left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey)
        );
      await persistBurgerSourceRecordPageWithClient(client, { sourceKey: burgerSourceKey, drafts });

      for (const product of polluted) {
        const normalized = normalizeBurgerSnapshotProduct(product);
        const canonicalMatch = strictMatchShopCatalogV2Compatibility(policyForBurger(product), {
          scope: "auto",
          make: "bmw",
          model: "m5",
          chassis: "g90",
          engine: "s68",
        });
        assert.notEqual(
          canonicalMatch.status,
          "exact",
          `${product.slug} must not survive as a BMW M5 G90 match`
        );
        if (normalized.mode === "NEEDS_REVIEW") {
          assert.ok(normalized.issues.includes("multi_make_correlation_unresolved"));
          assert.equal(canonicalMatch.status, "requires_verification");
        } else {
          assert.equal(canonicalMatch.status, "no_match");
        }
      }
      const validPolicy = policyForBurger(valid);
      assert.equal(
        strictMatchShopCatalogV2Compatibility(validPolicy, {
          scope: "auto",
          make: "bmw",
          model: "m5",
          chassis: "g90",
          engine: "s68",
          year: 2025,
        }).status,
        "exact"
      );
      const persistedValid = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: {
          targetKey: `variant:${normalizeBurgerSnapshotProduct(valid).variantId}`,
          isActive: true,
        },
        include: { clauses: { include: { constraints: { include: { values: true } } } } },
      });
      assert.equal(persistedValid.mode, "VEHICLE_SPECIFIC");
      const engineValue = persistedValid.clauses[0]!.constraints.find(
        (item) => item.dimension === "ENGINE"
      )!.values[0]!;
      assert.ok(engineValue.powertrainId);
      assert.equal(
        (
          await client.vehiclePowertrain.findUniqueOrThrow({
            where: { id: engineValue.powertrainId },
          })
        ).code,
        "S68"
      );
      assert.ok(
        (await client.shopCatalogFieldProvenance.count({
          where: { productId: valid.id, fieldPath: "tags" },
        })) > 0
      );

      const { coordinateShopCatalogProductMutation } =
        await import("../../../src/lib/shopCatalogMutationCoordinator.server");
      const { buildShopCatalogAdminSnapshot } =
        await import("../../../src/lib/shopCatalogAdminSnapshot.server");
      const { projectionSourceFromRevision } =
        await import("../../../src/lib/shopCatalogProjectionSource.server");
      await coordinateShopCatalogProductMutation({
        productId: valid.id,
        expectedCatalogVersion: "0",
        changeDomains: ["FITMENT"],
        async mutateAndSnapshot(tx, version) {
          return buildShopCatalogAdminSnapshot(tx, valid.id, version, {
            type: "TEST",
            reason: "canonical engine round trip",
          });
        },
      });
      const revision = await client.shopCatalogProductRevision.findFirstOrThrow({
        where: { productId: valid.id, version: BigInt(1) },
      });
      const roundTrip = projectionSourceFromRevision({
        productId: valid.id,
        catalogVersion: BigInt(1),
        revisionId: revision.id,
        revisionVersion: revision.version,
        contentHash: revision.contentHash,
        createdAt: revision.createdAt,
        snapshot: revision.snapshot,
      });
      const replayedEngine = roundTrip.compatibilityPolicies?.[0]?.clauses[0]?.constraints.find(
        (item) => item.dimension === "engine"
      );
      assert.ok(replayedEngine && replayedEngine.state === "EXACT");
      assert.equal(
        replayedEngine.values[0] &&
          typeof replayedEngine.values[0] === "object" &&
          "kind" in replayedEngine.values[0]
          ? replayedEngine.values[0].kind
          : null,
        "powertrain"
      );

      const { buildShopCatalogProjection } = await projectionModule;
      const { persistShopCatalogProjectionBuild } = await projectionPersistenceModule;
      const source = projectionSource(valid);
      source.canonicalPowertrains = [
        {
          variantId: normalizeBurgerSnapshotProduct(valid).variantId,
          clauseId: "application-1",
          code: "S68",
          powertrainId: engineValue.powertrainId!,
        },
      ];
      await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
      assert.equal(
        (
          await client.shopCatalogProjectionConstraint.findFirstOrThrow({
            where: { productId: valid.id, dimension: "ENGINE", state: "EXACT" },
          })
        ).powertrainId,
        engineValue.powertrainId
      );
      const { queryShopCatalogProjection } = await projectionQueryModule;
      const projected = await queryShopCatalogProjection({
        locale: "en",
        scope: "auto",
        make: "BMW",
        model: "M5",
        generation: "G90",
        engine: "S68",
        productIds,
      });
      assert.deepEqual(
        projected.items.map((item) => item.productId),
        [valid.id]
      );

      const { buildEventuriSourceRecordDraft } = await eventuriNormalizationModule;
      const { persistEventuriSourceRecordPageWithClient } = await eventuriBackfillModule;
      const eventuriProduct = {
        id: `search-correctness-eventuri-${suffix}`,
        slug: `search-correctness-eventuri-${suffix}`,
        sku: `EVE-${suffix}`,
        scope: "SHOP",
        brand: "Eventuri",
        title: { ua: "BMW M3 M4 S58 Intake", en: "BMW M3 M4 S58 Intake" },
        tags: ["Eventuri", "category:intake", "BMW", "M3", "G80", "S58", "store:main"],
        gallery: [],
        variants: [
          {
            id: `search-correctness-eventuri-${suffix}-variant`,
            sku: `EVE-${suffix}`,
            isDefault: true,
          },
        ],
      };
      productIds.push(eventuriProduct.id);
      await client.shopProduct.create({
        data: {
          id: eventuriProduct.id,
          slug: eventuriProduct.slug,
          titleUa: eventuriProduct.title.ua,
          titleEn: eventuriProduct.title.en,
          variants: {
            create: {
              id: eventuriProduct.variants[0]!.id,
              title: "Default",
              sku: eventuriProduct.sku,
              isDefault: true,
            },
          },
        },
      });
      await persistEventuriSourceRecordPageWithClient(client, {
        sourceKey: eventuriSourceKey,
        drafts: [
          buildEventuriSourceRecordDraft({
            product: eventuriProduct,
            sourceRevision: "fixture-v1",
          }),
        ],
      });
      const eventuriPolicy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({
        where: { targetKey: `variant:${eventuriProduct.variants[0]!.id}`, isActive: true },
        include: { clauses: { include: { constraints: { include: { values: true } } } } },
      });
      assert.equal(eventuriPolicy.mode, "VEHICLE_SPECIFIC");
      assert.equal(
        eventuriPolicy.clauses[0]!.constraints.find((item) => item.dimension === "FUEL")!.values[0]!
          .textValue,
        "petrol"
      );
    } finally {
      // The source-record, provenance, and binding tables are intentionally
      // append-only. Unique IDs prevent fixture replay collisions; the disposable
      // database is reset by its owner rather than bypassing those safeguards.
      await client.$disconnect();
    }
  }
);
