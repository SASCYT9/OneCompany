import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  normalizeLegacyApplicationsToShopCatalogV2Policy,
  SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS,
  SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
  type ShopCatalogV2CompatibilityPolicy,
} from "../../../src/lib/shopCatalogV2Compatibility";
import type {
  ShopCatalogProjectionBuild,
  ShopCatalogProjectionSource,
} from "../../../src/lib/shopCatalogProjection.server";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const projectionModule = import("../../../src/lib/shopCatalogProjection.server");
const parityModule = import("../../../src/lib/shopCatalogProjectionParity.server");
const flagModule = import("../../../src/lib/shopCatalogShadowFlag.server");

function compatibilityPolicy(productId: string): ShopCatalogV2CompatibilityPolicy {
  return normalizeLegacyApplicationsToShopCatalogV2Policy({
    target: { productId },
    requiredDimensions: ["make", "model", "generation", "year", "engine", "fuel"],
    verification: "VERIFIED",
    applications: [
      {
        id: "eventuri-f87",
        make: "BMW",
        model: "M2",
        generation: "F87 generation",
        chassisCode: "F87",
        yearFrom: 2016,
        yearTo: 2020,
        engine: "N55",
        fuel: "petrol",
      },
      {
        id: "eventuri-g80",
        make: "BMW",
        model: "M3",
        generation: "G80 generation",
        chassisCode: "G80",
        yearFrom: 2021,
        engine: "S58",
        fuel: "petrol",
      },
    ],
  });
}

function projectionSource(productId = "product-eventuri"): ShopCatalogProjectionSource {
  return {
    productId,
    sourceVersion: BigInt(7),
    catalogVersion: BigInt(42),
    sourceUpdatedAt: new Date("2026-08-30T12:00:00.000Z"),
    canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: {
      variants: 2,
      media: 4,
      applications: 2,
      metafields: 3,
      attributes: 5,
    },
    slug: `${productId}-slug`,
    sku: "EVE-INTAKE-01",
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "preOrder",
    isPublished: true,
    stableRank: 120,
    brand: {
      id: "brand-eventuri",
      key: "eventuri",
      labelUa: "Eventuri",
      labelEn: "Eventuri",
    },
    category: {
      id: "category-intake",
      key: "intake",
      labelUa: "Впуск",
      labelEn: "Intake",
    },
    productTypeKey: "intake-system",
    productKindKey: "intake",
    categoryGroupKey: "performance",
    locales: {
      ua: {
        title: "Карбоновий впуск Eventuri",
        cardCopy: "Перевірена сумісність для BMW.",
        searchTerms: ["впуск", "карбон"],
      },
      en: {
        title: "Eventuri carbon intake",
        cardCopy: "Verified compatibility for BMW.",
        searchTerms: ["carbon", "intake"],
      },
    },
    primaryMedia: {
      assetId: "media-primary",
      url: "https://cdn.example.com/eventuri.webp",
      width: 1_600,
      height: 1_200,
      version: "sha256:media",
    },
    tags: ["performance", "carbon", "eventuri"],
    collectionKeys: ["bmw-performance", "intakes"],
    sharedSearchTerms: ["EVE INTAKE 01", "BMW"],
    variants: [
      { variantId: "variant-black", sku: "EVE-INTAKE-01-BLK", stableRank: 2 },
      {
        variantId: "variant-red",
        sku: "EVE-INTAKE-01-RED",
        stableRank: 1,
        isDefault: true,
      },
    ],
    compatibilityPolicies: [compatibilityPolicy(productId)],
  };
}

function reorderedPolicy(
  policy: ShopCatalogV2CompatibilityPolicy
): ShopCatalogV2CompatibilityPolicy {
  return {
    ...policy,
    requiredDimensions: [...policy.requiredDimensions].reverse(),
    clauses: [...policy.clauses].reverse().map((clause) => ({
      ...clause,
      constraints: [...clause.constraints]
        .reverse()
        .map((constraint) =>
          constraint.state === "EXACT"
            ? { ...constraint, values: [...constraint.values].reverse() }
            : constraint
        ),
    })),
  };
}

test("ShopCatalogProjection rebuild is deterministic and leaves canonical input untouched", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const source = projectionSource();
  const sourceBefore = structuredClone(source);
  const first = buildShopCatalogProjection(source);
  const reordered = buildShopCatalogProjection({
    ...source,
    tags: [...(source.tags ?? [])].reverse(),
    collectionKeys: [...(source.collectionKeys ?? [])].reverse(),
    sharedSearchTerms: [...(source.sharedSearchTerms ?? [])].reverse(),
    variants: [...(source.variants ?? [])].reverse(),
    compatibilityPolicies: (source.compatibilityPolicies ?? []).map(reorderedPolicy),
  });

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(reordered, first);
  assert.equal(reordered.contentHash, first.contentHash);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.projections[0]), true);
});

test("projection rows are compact, localized, versioned, and keep variant SKU child rows", async () => {
  const { buildShopCatalogProjection, SHOP_CATALOG_PROJECTION_LIMITS } = await projectionModule;
  const projection = buildShopCatalogProjection(projectionSource());

  assert.deepEqual(
    projection.projections.map((record) => record.locale),
    ["ua", "en"]
  );
  assert.equal(projection.sourceVersion, "7");
  assert.equal(projection.catalogVersion, "42");
  assert.equal(projection.projectionVersion, "42");
  assert.equal(projection.projections[0].sourceVersion, "7");
  assert.equal(projection.projections[0].projectionVersion, "42");
  assert.equal(projection.canonicalRelationHash.length, 64);
  assert.equal(projection.projections[0].canonicalRelationHash, projection.canonicalRelationHash);
  assert.equal(projection.sourceContentHash, "a".repeat(64));
  assert.deepEqual(projection.canonicalRelationCounts, [
    { relation: "applications", count: 2 },
    { relation: "attributes", count: 5 },
    { relation: "media", count: 4 },
    { relation: "metafields", count: 3 },
    { relation: "variants", count: 2 },
  ]);
  assert.equal(projection.projections[0].brandKey, "eventuri");
  assert.equal(projection.projections[0].primaryMedia?.width, 1_600);
  assert.ok(projection.projections[0].searchText.includes("eventuri"));
  assert.ok(
    projection.projections[0].searchText.length <= SHOP_CATALOG_PROJECTION_LIMITS.searchText
  );
  assert.deepEqual(
    projection.skuRecords.map((record) => [record.variantId, record.normalizedSku]),
    [
      [null, "eveintake01"],
      ["variant-red", "eveintake01red"],
      ["variant-black", "eveintake01blk"],
    ]
  );
  assert.ok(JSON.stringify(projection.projections[0]).length < 32_000);
});

test("compatibility projection preserves correlated clauses and every required facet", async () => {
  const { buildShopCatalogProjection, SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS } =
    await projectionModule;
  const projection = buildShopCatalogProjection(projectionSource());
  const exactText = (clauseId: string, dimension: string) =>
    projection.compatibilityConstraints
      .filter(
        (row) =>
          row.clauseId === clauseId && row.dimension === dimension && row.value?.kind === "text"
      )
      .map((row) => (row.value?.kind === "text" ? row.value.text : null));

  assert.deepEqual(SHOP_CATALOG_PROJECTION_FILTER_DIMENSIONS, [
    "brand",
    "make",
    "model",
    "generation",
    "year",
    "engine",
    "fuel",
  ]);
  assert.equal(projection.projections[0].brandKey, "eventuri");
  assert.deepEqual(exactText("eventuri-f87", "make"), ["bmw"]);
  assert.deepEqual(exactText("eventuri-f87", "model"), ["m2"]);
  assert.deepEqual(exactText("eventuri-f87", "generation"), ["f87 generation"]);
  assert.deepEqual(exactText("eventuri-f87", "engine"), ["n55"]);
  assert.deepEqual(exactText("eventuri-f87", "fuel"), ["petrol"]);
  assert.deepEqual(exactText("eventuri-g80", "model"), ["m3"]);
  assert.deepEqual(exactText("eventuri-g80", "engine"), ["s58"]);
  assert.equal(
    projection.compatibilityConstraints.some(
      (row) =>
        row.clauseId === "eventuri-f87" &&
        row.dimension === "year" &&
        row.value?.kind === "year_range"
    ),
    true
  );
  assert.equal(
    projection.compatibilityConstraints.some(
      (row) =>
        row.clauseId === "eventuri-f87" &&
        row.dimension === "market" &&
        row.state === "UNKNOWN" &&
        row.value === null
    ),
    true
  );
  assert.equal(projection.compatibilityClauses.length, 2);
});

test("projection preserves UNIVERSAL and canonical PARENT_DEPENDENT identity without broadening", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const universalPolicy = {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: "UNIVERSAL",
    target: { productId: "universal-product" },
    parentTarget: null,
    requiredDimensions: [],
    clauses: [
      {
        id: "universal-auto",
        verification: "VERIFIED",
        constraints: SHOP_CATALOG_V2_COMPATIBILITY_DIMENSIONS.map((dimension) =>
          dimension === "scope"
            ? { dimension, state: "EXACT" as const, values: ["auto"] }
            : { dimension, state: "ANY" as const }
        ),
      },
    ],
  } satisfies ShopCatalogV2CompatibilityPolicy;
  const universal = buildShopCatalogProjection({
    ...projectionSource("universal-product"),
    compatibilityPolicies: [universalPolicy],
  });

  assert.deepEqual(universal.compatibilityPolicies[0], {
    productId: "universal-product",
    variantId: null,
    parentProductId: null,
    parentVariantId: null,
    mode: "UNIVERSAL",
    sourceVersion: "7",
    requiredDimensions: [],
    dimensionDefaults: [],
    clauseCount: 1,
  });

  const parentPolicy: ShopCatalogV2CompatibilityPolicy = {
    version: SHOP_CATALOG_V2_COMPATIBILITY_VERSION,
    mode: "PARENT_DEPENDENT",
    target: { productId: "replacement-part" },
    parentTarget: { productId: "canonical-parent", variantId: "canonical-parent-black" },
    requiredDimensions: [],
    clauses: [],
  };
  const parent = buildShopCatalogProjection({
    ...projectionSource("replacement-part"),
    compatibilityPolicies: [parentPolicy],
  });

  assert.equal(parent.compatibilityPolicies[0].mode, "PARENT_DEPENDENT");
  assert.equal(parent.compatibilityPolicies[0].parentProductId, "canonical-parent");
  assert.equal(parent.compatibilityPolicies[0].parentVariantId, "canonical-parent-black");
  assert.equal(parent.compatibilityPolicies[0].clauseCount, 0);
  assert.deepEqual(parent.compatibilityClauses, []);
  assert.deepEqual(parent.compatibilityConstraints, []);
});

test("projection builder rejects invalid compatibility and preserves long catalog copy", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const source = projectionSource();
  const invalidPolicy = {
    ...compatibilityPolicy(source.productId),
    target: { productId: source.productId, variantId: "missing-variant" },
  };
  assert.throws(
    () => buildShopCatalogProjection({ ...source, compatibilityPolicies: [invalidPolicy] }),
    /unknown variant/
  );
  const longCopy = "x".repeat(2_049);
  const projection = buildShopCatalogProjection({
    ...source,
    locales: {
      ...source.locales,
      en: { ...source.locales.en, cardCopy: longCopy },
    },
  });
  assert.equal(projection.projections.find((row) => row.locale === "en")?.cardCopy, longCopy);
});

test("bounded batch builder uses deterministic product-id cursor and rejects full-catalog input", async () => {
  const { buildShopCatalogProjectionBatch, SHOP_CATALOG_PROJECTION_LIMITS } =
    await projectionModule;
  const batch = buildShopCatalogProjectionBatch([
    projectionSource("product-002"),
    projectionSource("product-001"),
  ]);
  assert.deepEqual(
    batch.products.map((product) => product.productId),
    ["product-001", "product-002"]
  );
  assert.equal(batch.nextCursor, "product-002");
  assert.equal(batch.productCount, 2);
  assert.ok(batch.derivedRowCount > batch.productCount * 2);
  assert.ok(batch.derivedRowCount <= SHOP_CATALOG_PROJECTION_LIMITS.derivedRowsPerBatch);

  const oversized = Array.from(
    { length: SHOP_CATALOG_PROJECTION_LIMITS.batchSize + 1 },
    (_, index) => projectionSource(`product-${String(index).padStart(4, "0")}`)
  );
  assert.throws(() => buildShopCatalogProjectionBatch(oversized), /batch exceeds 500 products/);
});

test("per-product parity distinguishes projected fields from canonical loss-ledger references", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { compareShopCatalogProjectionBuilds, compareShopCatalogProjectionToSource } =
    await parityModule;
  const source = projectionSource();
  const projection = buildShopCatalogProjection(source);
  const exact = compareShopCatalogProjectionToSource(source, projection);
  assert.equal(exact.parity, true);
  assert.equal(exact.projectedFieldsMatch, true);
  assert.equal(exact.canonicalLossLedgerReferenceMatch, true);
  assert.equal(exact.canonicalDataEmbedded, false);

  const changedProjection = structuredClone(projection) as ShopCatalogProjectionBuild;
  (changedProjection.projections[0] as { title: string }).title = "Changed card title";
  const cardMismatch = compareShopCatalogProjectionBuilds(projection, changedProjection);
  assert.equal(cardMismatch.parity, false);
  assert.equal(cardMismatch.projectedFieldsMatch, false);
  assert.equal(cardMismatch.canonicalLossLedgerReferenceMatch, true);

  const changedLedger = {
    ...projection,
    sourceContentHash: "b".repeat(64),
  } satisfies ShopCatalogProjectionBuild;
  const ledgerMismatch = compareShopCatalogProjectionBuilds(projection, changedLedger);
  assert.equal(ledgerMismatch.projectedFieldsMatch, true);
  assert.equal(ledgerMismatch.canonicalLossLedgerReferenceMatch, false);
});

test("projection replacement decision is idempotent and rejects stale or conflicting events", async () => {
  const { buildShopCatalogProjection } = await projectionModule;
  const { decideShopCatalogProjectionReplacement } = await parityModule;
  const current = buildShopCatalogProjection(projectionSource());
  const stale = buildShopCatalogProjection({
    ...projectionSource(),
    catalogVersion: 41,
  });
  const newer = buildShopCatalogProjection({
    ...projectionSource(),
    sourceVersion: 8,
    catalogVersion: 43,
    canonicalContentHash: "b".repeat(64),
  });
  const conflict = {
    ...current,
    contentHash: "c".repeat(64),
  } satisfies ShopCatalogProjectionBuild;

  assert.deepEqual(decideShopCatalogProjectionReplacement(null, current), {
    apply: true,
    reason: "INSERT",
  });
  assert.deepEqual(decideShopCatalogProjectionReplacement(current, current), {
    apply: false,
    reason: "IDEMPOTENT",
  });
  assert.deepEqual(decideShopCatalogProjectionReplacement(current, stale), {
    apply: false,
    reason: "STALE_VERSION",
  });
  assert.deepEqual(decideShopCatalogProjectionReplacement(current, newer), {
    apply: true,
    reason: "NEWER_VERSION",
  });
  assert.deepEqual(decideShopCatalogProjectionReplacement(current, conflict), {
    apply: false,
    reason: "VERSION_CONFLICT",
  });
});

test("shadow result parity compares order, payload, and all progressive facet counts", async () => {
  const { compareShopCatalogShadowResults } = await parityModule;
  const legacy = {
    catalogVersion: "42",
    totalItems: 2,
    items: [
      { key: "product-1", payloadHash: "hash-1" },
      { key: "product-2", payloadHash: "hash-2" },
    ],
    facets: {
      brand: [{ key: "eventuri", count: 2 }],
      make: [{ key: "bmw", count: 2 }],
      model: [
        { key: "m2", count: 1 },
        { key: "m3", count: 1 },
      ],
      generation: [{ key: "g80 generation", count: 1 }],
      year: [{ key: "2021+", count: 1 }],
      engine: [{ key: "s58", count: 1 }],
      fuel: [{ key: "petrol", count: 2 }],
    },
  } as const;
  const sameWithFacetOrderChanged = {
    ...legacy,
    facets: { ...legacy.facets, model: [...legacy.facets.model].reverse() },
  };
  assert.equal(compareShopCatalogShadowResults(legacy, sameWithFacetOrderChanged).parity, true);

  const changed = {
    ...legacy,
    items: [
      { key: "product-2", payloadHash: "changed" },
      { key: "product-3", payloadHash: "hash-3" },
    ],
    facets: { ...legacy.facets, engine: [{ key: "s58", count: 2 }] },
  };
  const mismatch = compareShopCatalogShadowResults(legacy, changed, 2);
  assert.equal(mismatch.parity, false);
  assert.equal(mismatch.orderedItemsMatch, false);
  assert.equal(mismatch.facetsMatch, false);
  assert.deepEqual(mismatch.missingItems, ["product-1"]);
  assert.deepEqual(mismatch.unexpectedItems, ["product-3"]);
  assert.equal(mismatch.facetMismatchCount, 1);
  assert.equal(mismatch.samplesTruncated, true);
});

test("shadow parity fails closed when a response exceeds the bounded page contract", async () => {
  const { compareShopCatalogShadowResults, SHOP_CATALOG_SHADOW_PARITY_LIMITS } = await parityModule;
  const oversized = {
    catalogVersion: "42",
    totalItems: SHOP_CATALOG_SHADOW_PARITY_LIMITS.comparedItems + 1,
    items: Array.from(
      { length: SHOP_CATALOG_SHADOW_PARITY_LIMITS.comparedItems + 1 },
      (_, index) => ({ key: `product-${index}` })
    ),
  };
  const result = compareShopCatalogShadowResults(oversized, oversized);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.parity, false);
  assert.match(result.coverageIssues.join(" "), /items_exceed_100/);
});

test("shadow feature flag is production-default-off and exposes compare-only mode", async () => {
  const { resolveShopCatalogShadowFlag } = await flagModule;
  assert.deepEqual(resolveShopCatalogShadowFlag({ nodeEnv: "production" }), {
    enabled: false,
    mode: "off",
    production: true,
    reason: "default_off",
  });
  assert.deepEqual(resolveShopCatalogShadowFlag({ nodeEnv: "production", mode: "true" }), {
    enabled: false,
    mode: "off",
    production: true,
    reason: "invalid_value",
  });
  assert.deepEqual(resolveShopCatalogShadowFlag({ nodeEnv: "production", mode: "compare" }), {
    enabled: true,
    mode: "compare",
    production: true,
    reason: "explicit_compare",
  });

  const source = readFileSync("src/lib/shopCatalogShadowFlag.server.ts", "utf8");
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /mode:\s*["']serve/);
});
