import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogPublicationPlan,
  decideShopCatalogProjectionEvent,
  normalizeShopCatalogChangeDomains,
  resolveShopCatalogPublicationStatus,
} from "../../../src/lib/shopCatalogPublication";

test("publication plans are deterministic, versioned, exact, and JSON serializable", () => {
  const plan = buildShopCatalogPublicationPlan({
    entityType: "PRODUCT",
    entityId: " product-1 ",
    canonicalVersion: "12",
    changeDomains: ["PRICE", "CONTENT", "MEDIA", "PRICE"],
    oldSlug: "Old-Slug",
    newSlug: "new-slug",
  });

  assert.deepEqual(plan.changeDomains, ["CONTENT", "MEDIA", "PRICE"]);
  assert.deepEqual(plan.projectionTargets, ["CONTENT", "SEARCH", "PRICE"]);
  assert.deepEqual(plan.productIds, ["product-1"]);
  assert.equal(plan.oldSlug, "old-slug");
  assert.equal(plan.newSlug, "new-slug");
  assert.deepEqual(plan.slugKeys, ["old-slug", "new-slug"]);
  assert.equal(plan.dedupeKey, "SHOP_CATALOG:1:PRODUCT:product-1:12");
  assert.equal(plan.allowBroadInvalidation, false);
  assert.doesNotThrow(() => JSON.stringify(plan));
});

test("volatile price and inventory updates avoid content/search regeneration", () => {
  const plan = buildShopCatalogPublicationPlan({
    entityType: "PRODUCT",
    entityId: "product-volatile",
    canonicalVersion: "9",
    changeDomains: ["INVENTORY", "PRICE"],
  });

  assert.deepEqual(plan.projectionTargets, ["PRICE", "INVENTORY"]);
  assert.equal(plan.oldSlug, null);
  assert.equal(plan.newSlug, null);
  assert.deepEqual(plan.slugKeys, []);
  assert.equal(plan.projectionTargets.includes("SEARCH"), false);
  assert.equal(plan.projectionTargets.includes("CONTENT"), false);
});

test("media changes update card/search content and carry exact PDP invalidation keys", () => {
  const plan = buildShopCatalogPublicationPlan({
    entityType: "PRODUCT",
    entityId: "product-media",
    canonicalVersion: "10",
    changeDomains: ["MEDIA"],
    newSlug: "Product-Media",
  });

  assert.deepEqual(plan.projectionTargets, ["CONTENT", "SEARCH"]);
  assert.deepEqual(plan.slugKeys, ["product-media"]);
});

test("a canonical entity version has one dedupe identity regardless of domain ordering", () => {
  const content = buildShopCatalogPublicationPlan({
    entityType: "PRODUCT",
    entityId: "product-1",
    canonicalVersion: "12",
    changeDomains: ["CONTENT"],
    newSlug: "product-1",
  });
  const media = buildShopCatalogPublicationPlan({
    entityType: "PRODUCT",
    entityId: "product-1",
    canonicalVersion: "12",
    changeDomains: ["MEDIA"],
    newSlug: "product-1",
  });

  assert.equal(content.dedupeKey, media.dedupeKey);
});

test("settings versions are global and never fan out to product invalidations", () => {
  const plan = buildShopCatalogPublicationPlan({
    entityType: "SETTINGS",
    entityId: "public-shop-settings",
    canonicalVersion: "3",
    changeDomains: ["SETTINGS"],
  });

  assert.deepEqual(plan.projectionTargets, ["SETTINGS"]);
  assert.deepEqual(plan.productIds, []);
  assert.deepEqual(plan.slugKeys, []);
});

test("price-book versions update volatile price state without product fanout", () => {
  const plan = buildShopCatalogPublicationPlan({
    entityType: "PRICE_BOOK",
    entityId: "eu-retail",
    canonicalVersion: "4",
    changeDomains: ["PRICE"],
  });

  assert.deepEqual(plan.projectionTargets, ["PRICE"]);
  assert.deepEqual(plan.productIds, []);
  assert.deepEqual(plan.slugKeys, []);
});

test("stale and replayed events cannot overwrite a newer projection", () => {
  assert.equal(decideShopCatalogProjectionEvent("11", null), "APPLY");
  assert.equal(decideShopCatalogProjectionEvent("11", "10"), "APPLY");
  assert.equal(decideShopCatalogProjectionEvent("11", "11"), "SKIP_IDEMPOTENT");
  assert.equal(decideShopCatalogProjectionEvent("10", "11"), "SKIP_STALE");
});

test("saved, publishing, published, and failed are distinct states", () => {
  assert.equal(
    resolveShopCatalogPublicationStatus({
      canonicalVersion: "5",
      requiredTargets: ["CONTENT", "SEARCH"],
      targetStates: [
        { target: "CONTENT", appliedVersion: "5" },
        { target: "SEARCH", appliedVersion: "4" },
      ],
    }),
    "SAVED"
  );
  assert.equal(
    resolveShopCatalogPublicationStatus({
      canonicalVersion: "5",
      requiredTargets: ["CONTENT", "SEARCH"],
      targetStates: [
        { target: "CONTENT", appliedVersion: "5" },
        { target: "SEARCH", appliedVersion: "4", processingVersion: "5" },
      ],
    }),
    "PUBLISHING"
  );
  assert.equal(
    resolveShopCatalogPublicationStatus({
      canonicalVersion: "5",
      requiredTargets: ["CONTENT", "SEARCH"],
      targetStates: [
        { target: "CONTENT", appliedVersion: "5" },
        { target: "SEARCH", appliedVersion: "5" },
      ],
    }),
    "PUBLISHED"
  );
  assert.equal(
    resolveShopCatalogPublicationStatus({
      canonicalVersion: "5",
      requiredTargets: ["CONTENT", "SEARCH"],
      targetStates: [
        { target: "CONTENT", appliedVersion: "5" },
        { target: "SEARCH", appliedVersion: "4", failedVersion: "5" },
      ],
    }),
    "FAILED"
  );
});

test("invalid or unversioned publication inputs fail closed", () => {
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "0",
        changeDomains: ["CONTENT"],
        newSlug: "product-1",
      }),
    /greater than zero/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "1",
        changeDomains: [],
        newSlug: "product-1",
      }),
    /At least one/
  );
  assert.throws(
    () => normalizeShopCatalogChangeDomains(["CONTENT", "UNKNOWN" as "CONTENT"]),
    /Unsupported/
  );
  assert.throws(
    () =>
      resolveShopCatalogPublicationStatus({
        canonicalVersion: "5",
        requiredTargets: ["CONTENT"],
        targetStates: [{ target: "CONTENT", appliedVersion: "6" }],
      }),
    /cannot be newer/
  );
  assert.throws(
    () =>
      resolveShopCatalogPublicationStatus({
        canonicalVersion: "5",
        requiredTargets: ["CONTENT"],
        targetStates: [{ target: "CONTENT", appliedVersion: "" }],
      }),
    /non-negative decimal integer string/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "9223372036854775808",
        changeDomains: ["PRICE"],
      }),
    /PostgreSQL bigint/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "1",
        changeDomains: ["SETTINGS"],
      }),
    /cannot carry SETTINGS/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "SETTINGS",
        entityId: "shop-settings",
        canonicalVersion: "1",
        changeDomains: ["CONTENT"],
      }),
    /cannot carry CONTENT/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "1",
        changeDomains: ["PRICE"],
        oldSlug: "old-slug",
        newSlug: "new-slug",
      }),
    /Slug changes require/
  );
  assert.throws(
    () =>
      buildShopCatalogPublicationPlan({
        entityType: "UNKNOWN" as "PRODUCT",
        entityId: "product-1",
        canonicalVersion: "1",
        changeDomains: ["PRICE"],
      }),
    /Unsupported catalog publication entity type/
  );
});
