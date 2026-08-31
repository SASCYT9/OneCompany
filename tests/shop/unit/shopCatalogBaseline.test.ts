import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogLossLedger,
  compareShopCatalogLossLedgers,
  fingerprintCatalogSnapshotMetadata,
  hashCatalogBaselineValue,
  stableCatalogBaselineJson,
} from "../../../src/lib/shopCatalogBaseline";

function fixtureProduct() {
  return {
    id: "product-racechip",
    slug: "racechip-gts",
    sku: "RC-GTS",
    titleUa: "RaceChip GTS",
    titleEn: "RaceChip GTS",
    bodyHtmlUa: "Повний опис",
    bodyHtmlEn: "Full description",
    priceEur: "649.00",
    compareAtEur: "699.00",
    tags: ["engine", "racechip"],
    gallery: ["front.jpg", "rear.jpg"],
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    variants: [
      {
        id: "variant-b58",
        sku: "RC-GTS-B58",
        position: 2,
        option1Value: "B58",
        priceEur: "649.00",
        inventoryLevels: [
          {
            id: "inventory-b58-kyiv",
            variantId: "variant-b58",
            locationId: "warehouse-kyiv",
            stockedQuantity: 4,
            reservedQuantity: 1,
            incomingQuantity: 2,
          },
        ],
      },
      {
        id: "variant-b48",
        sku: "RC-GTS-B48",
        position: 1,
        option1Value: "B48",
        priceEur: "629.00",
        inventoryLevels: [
          {
            id: "inventory-b48-kyiv",
            variantId: "variant-b48",
            locationId: "warehouse-kyiv",
            stockedQuantity: 3,
            reservedQuantity: 0,
            incomingQuantity: 0,
          },
        ],
      },
    ],
    media: [
      { id: "media-2", position: 2, src: "rear.jpg", mediaType: "IMAGE" },
      { id: "media-1", position: 1, src: "front.jpg", mediaType: "IMAGE" },
    ],
    collections: [
      {
        productId: "product-racechip",
        collectionId: "power",
        sortOrder: 3,
        collection: { id: "power", handle: "power", titleUa: "Потужність", titleEn: "Power" },
      },
    ],
    options: [{ id: "option-engine", position: 1, name: "Engine", values: ["B48", "B58"] }],
    metafields: [
      {
        id: "meta-gain",
        namespace: "spec",
        key: "power_gain",
        value: "80",
        valueType: "number_integer",
      },
    ],
    vehicleApplications: [
      {
        id: "application-b58",
        applicationKey: "bmw-g20-b58",
        revision: 1,
        make: "BMW",
        model: "3 Series",
        chassisCode: "G20",
        engine: "B58",
        fuel: "petrol",
        variantId: "variant-b58",
        variantKnowledgeId: "variant-knowledge-b58",
        verificationStatus: "VERIFIED",
      },
    ],
    bundle: {
      id: "bundle-racechip",
      productId: "product-racechip",
      items: [
        {
          id: "bundle-item-b58",
          bundleId: "bundle-racechip",
          componentProductId: "product-racechip",
          componentVariantId: "variant-b58",
          quantity: 1,
          position: 1,
          componentProduct: {
            id: "product-racechip",
            slug: "racechip-gts",
            sku: "RC-GTS",
            ignoredPrice: "649.00",
          },
          componentVariant: {
            id: "variant-b58",
            productId: "product-racechip",
            sku: "RC-GTS-B58",
            ignoredInventory: 4,
          },
        },
      ],
    },
    bundleComponentItems: [
      {
        id: "bundle-usage-racechip",
        bundleId: "bundle-other",
        componentProductId: "product-racechip",
        componentVariantId: null,
        quantity: 1,
        position: 2,
        bundle: { id: "bundle-other", productId: "product-other", ignored: "payload" },
      },
    ],
    knowledgeAttributeValues: [
      {
        id: "attribute-material",
        valueKey: "material",
        revision: 1,
        productId: "product-racechip",
        variantId: null,
        valueText: "composite",
        definition: { id: "definition-material", key: "material", nameUa: "Матеріал" },
      },
      {
        id: "attribute-engine-b58",
        valueKey: "engine-b58",
        revision: 1,
        productId: "product-racechip",
        variantId: "variant-b58",
        valueText: "B58",
        definition: { id: "definition-engine", key: "engine", nameUa: "Двигун" },
      },
    ],
    knowledgeChunks: [
      {
        id: "chunk-description-ua",
        chunkKey: "description-ua",
        revision: 1,
        locale: "ua",
        ordinal: 0,
        content: "RaceChip для BMW B58",
        contentHash: "chunk-hash",
      },
    ],
    knowledgeRevisions: [
      {
        id: "knowledge-revision-2",
        revision: 2,
        status: "READY",
        snapshot: { facts: { torqueGainNm: 120 } },
      },
    ],
    knowledgeReviewTasks: [
      {
        id: "review-fitment",
        taskType: "FITMENT",
        status: "OPEN",
        title: "Verify B58 fitment",
        details: { field: "engine" },
      },
    ],
    knowledgeOutboxEvents: [
      {
        id: "outbox-index",
        dedupeKey: "index-racechip-2",
        eventType: "INDEX",
        status: "PROCESSED",
        payload: { revision: 2 },
      },
    ],
    cartItems: [
      {
        id: "cart-item-racechip",
        productId: "product-racechip",
        variantId: "variant-b58",
        productSlug: "racechip-gts",
        cartId: "sensitive-cart-id",
        quantity: 4,
      },
    ],
    orderItems: [
      {
        id: "order-item-racechip",
        productId: "product-racechip",
        variantId: "variant-b48",
        productSlug: "racechip-gts",
        orderId: "sensitive-order-id",
        price: "629.00",
      },
    ],
    knowledge: {
      id: "knowledge-racechip",
      revision: 2,
      facts: { torqueGainNm: 120 },
      searchText: "RaceChip BMW B58",
      contentHash: "knowledge-hash",
      evidence: [
        {
          id: "evidence-1",
          evidenceKey: "fitment-b58",
          revision: 1,
          fieldPath: "applications.0.engine",
          source: "MANAGER",
          sourceHash: "source-hash",
        },
      ],
      variantKnowledge: [
        {
          id: "variant-knowledge-b58",
          variantId: "variant-b58",
          revision: 1,
          sku: "RC-GTS-B58",
          facts: { engine: "B58" },
          contentHash: "variant-knowledge-hash",
        },
      ],
    },
  };
}

test("canonical JSON and catalog fingerprints are deterministic", () => {
  assert.equal(
    stableCatalogBaselineJson({ z: 1, a: { y: 2, x: 3 } }),
    stableCatalogBaselineJson({ a: { x: 3, y: 2 }, z: 1 })
  );
  assert.equal(
    hashCatalogBaselineValue({ at: new Date("2026-01-01T00:00:00.000Z") }),
    hashCatalogBaselineValue({ at: new Date("2026-01-01T00:00:00.000Z") })
  );

  const first = fixtureProduct();
  const reordered = {
    ...fixtureProduct(),
    tags: ["racechip", "engine"],
    variants: [...fixtureProduct().variants].reverse(),
    media: [...fixtureProduct().media].reverse(),
  };
  const before = buildShopCatalogLossLedger([
    first,
    { id: "product-adro", slug: "adro", titleEn: "ADRO", titleUa: "ADRO" },
  ]);
  const after = buildShopCatalogLossLedger([
    { id: "product-adro", slug: "adro", titleUa: "ADRO", titleEn: "ADRO" },
    reordered,
  ]);

  assert.equal(after.fingerprint, before.fingerprint);
  assert.equal(after.contentFingerprint, before.contentFingerprint);
  assert.equal(after.identityFingerprint, before.identityFingerprint);
  assert.equal(Object.isFrozen(after), true);
  assert.equal(Object.isFrozen(after.products[0]), true);
});

test("loss ledger covers identities and every required information family", () => {
  const ledger = buildShopCatalogLossLedger([fixtureProduct()]);

  assert.deepEqual(ledger.counts, {
    products: 1,
    productsWithSku: 1,
    variants: 2,
    variantsWithSku: 2,
    media: 2,
    priceValues: 4,
    collections: 1,
    tags: 2,
    options: 1,
    metafields: 1,
    applications: 1,
    evidence: 1,
    knowledge: 1,
    variantKnowledge: 1,
    variantApplications: 1,
    bundles: 1,
    bundleItems: 1,
    bundleComponentUsages: 1,
    productAttributeValues: 1,
    variantAttributeValues: 1,
    knowledgeChunks: 1,
    knowledgeRevisions: 1,
    knowledgeReviewTasks: 1,
    knowledgeOutboxEvents: 1,
    inventoryLevels: 2,
    cartReferences: 1,
    orderReferences: 1,
  });
  assert.deepEqual(
    ledger.products[0].variantIdentities.map(({ id, sku }) => ({ id, sku })),
    [
      { id: "variant-b48", sku: "RC-GTS-B48" },
      { id: "variant-b58", sku: "RC-GTS-B58" },
    ]
  );
  assert.deepEqual(ledger.identityIssues, {
    productsMissingSku: 0,
    variantsMissingId: 0,
    variantsMissingSku: 0,
    duplicateVariantIds: [],
    duplicateProductSkus: [],
    duplicateVariantSkus: [],
  });
  assert.deepEqual(ledger.dependencyIssues, {
    missingBundleComponentProductIds: [],
    missingBundleComponentVariantIds: [],
    unknownCartProductIds: [],
    unknownCartVariantIds: [],
    cartProductVariantMismatches: [],
    unknownOrderProductIds: [],
    unknownOrderVariantIds: [],
    orderProductVariantMismatches: [],
  });
  assert.deepEqual(ledger.products[0].dependencyReferences.cartItems, [
    {
      id: "cart-item-racechip",
      productId: "product-racechip",
      variantId: "variant-b58",
      productSlug: "racechip-gts",
    },
  ]);
});

test("section hashes pinpoint locale, price, media, fitment, evidence and knowledge changes", () => {
  const before = buildShopCatalogLossLedger([fixtureProduct()]);
  const changed = fixtureProduct();
  changed.titleUa = "RaceChip GTS — нове";
  changed.priceEur = "659.00";
  changed.media[0].src = "rear-v2.jpg";
  changed.vehicleApplications[0].fuel = "hybrid";
  changed.knowledge.evidence[0].sourceHash = "source-hash-v2";
  changed.knowledge.facts = { torqueGainNm: 130 };
  const after = buildShopCatalogLossLedger([changed]);
  const diff = compareShopCatalogLossLedgers(before, after);

  assert.equal(diff.unchanged, false);
  const sections = diff.changedProducts[0].changedSections;
  for (const section of [
    "scalars",
    "locales",
    "prices",
    "media",
    "applications",
    "variantApplications",
    "evidence",
    "knowledge",
    "content",
    "full",
  ]) {
    assert.ok(sections.includes(section), `expected ${section} to change`);
  }
});

test("catalog-owned relation sections detect bundle, attributes, knowledge and inventory changes", () => {
  const before = buildShopCatalogLossLedger([fixtureProduct()]);
  const changed = fixtureProduct();
  changed.bundle.items[0].quantity = 2;
  changed.bundleComponentItems[0].position = 3;
  changed.knowledgeAttributeValues[0].valueText = "carbon composite";
  changed.knowledgeChunks[0].content = "Оновлений knowledge chunk";
  changed.knowledgeRevisions[0].snapshot = { facts: { torqueGainNm: 130 } };
  changed.knowledgeReviewTasks[0].status = "RESOLVED";
  changed.knowledgeOutboxEvents[0].payload = { revision: 3 };
  changed.variants[0].inventoryLevels[0].stockedQuantity = 5;

  const diff = compareShopCatalogLossLedgers(before, buildShopCatalogLossLedger([changed]));
  for (const section of [
    "bundle",
    "bundleComponentItems",
    "attributeValues",
    "knowledgeChunks",
    "knowledgeRevisions",
    "knowledgeReviewTasks",
    "knowledgeOutboxEvents",
    "inventoryLevels",
    "content",
    "full",
  ]) {
    assert.ok(diff.changedProducts[0].changedSections.includes(section), section);
  }
});

test("transaction payloads are excluded while safe dependency IDs detect dangling references", () => {
  const original = fixtureProduct();
  const sensitivePayloadChanged = fixtureProduct();
  sensitivePayloadChanged.cartItems[0].cartId = "another-sensitive-cart";
  sensitivePayloadChanged.cartItems[0].quantity = 99;
  sensitivePayloadChanged.orderItems[0].orderId = "another-sensitive-order";
  sensitivePayloadChanged.orderItems[0].price = "1.00";
  sensitivePayloadChanged.bundle.items[0].componentProduct.ignoredPrice = "1.00";
  sensitivePayloadChanged.bundle.items[0].componentVariant.ignoredInventory = 999;

  assert.equal(
    buildShopCatalogLossLedger([original]).fingerprint,
    buildShopCatalogLossLedger([sensitivePayloadChanged]).fingerprint
  );

  const dangling = fixtureProduct();
  dangling.orderItems[0].variantId = "missing-variant";
  const danglingLedger = buildShopCatalogLossLedger([dangling]);
  assert.deepEqual(danglingLedger.dependencyIssues.unknownOrderVariantIds, ["missing-variant"]);
  const diff = compareShopCatalogLossLedgers(
    buildShopCatalogLossLedger([original]),
    danglingLedger
  );
  assert.ok(diff.changedProducts[0].changedSections.includes("dependencyReferences"));
});

test("operational timestamps change the immutable full fingerprint but not content", () => {
  const beforeProduct = fixtureProduct();
  const afterProduct = fixtureProduct();
  afterProduct.updatedAt = new Date("2026-01-03T00:00:00.000Z");
  const before = buildShopCatalogLossLedger([beforeProduct]);
  const after = buildShopCatalogLossLedger([afterProduct]);

  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.contentFingerprint, before.contentFingerprint);
});

test("snapshot metadata fingerprint ignores generatedAt and validates shard counts", () => {
  const first = fingerprintCatalogSnapshotMetadata({
    version: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
    count: 2,
    stores: {
      urban: { file: "urban.0123456789ab.json", count: 1 },
      racechip: { file: "racechip.abcdefabcdef.json", count: 1 },
    },
    slugToStore: { one: "urban", two: "racechip" },
  });
  const second = fingerprintCatalogSnapshotMetadata({
    generatedAt: "2026-01-02T00:00:00.000Z",
    count: 2,
    version: 2,
    stores: {
      racechip: { count: 1, file: "racechip.abcdefabcdef.json" },
      urban: { count: 1, file: "urban.0123456789ab.json" },
    },
    slugToStore: { two: "racechip", one: "urban" },
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.throws(
    () =>
      fingerprintCatalogSnapshotMetadata({
        version: 2,
        count: 2,
        stores: { urban: { file: "urban.json", count: 1 } },
      }),
    /does not match count/
  );
});
