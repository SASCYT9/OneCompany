import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogCacheKey,
  resolveShopCatalogCachePolicy,
  type ShopCatalogCachePolicyInput,
} from "../../../src/lib/shopCatalogCacheContract";

function input(overrides: Partial<ShopCatalogCachePolicyInput> = {}): ShopCatalogCachePolicyInput {
  return {
    route: "facets",
    audience: "public",
    hasCustomerSession: false,
    isB2b: false,
    readerMode: "active",
    publicationStatus: "PUBLISHED",
    sourceCoverageComplete: true,
    canonicalVersion: "42",
    publishedVersion: "42",
    projectionVersion: "42",
    ...overrides,
  };
}

test("shares only a complete version-aligned public selector release", () => {
  const policy = resolveShopCatalogCachePolicy(input());
  assert.equal(policy.shareable, true);
  assert.equal(policy.cacheControl, "public, s-maxage=30, stale-while-revalidate=30");
  assert.equal(policy.reason, "public_complete_release");
});

test("fails closed for partial, stale, shadow, or rolled-back releases", () => {
  for (const overrides of [
    { sourceCoverageComplete: false, reason: "source_coverage_incomplete" },
    { publicationStatus: "PUBLISHING" as const, reason: "publication_not_complete" },
    { canonicalVersion: "43", reason: "version_mismatch" },
    { projectionVersion: null, reason: "version_missing" },
    { readerMode: "shadow" as const, reason: "shadow_reader" },
    { readerMode: "rollback" as const, reason: "reader_rollback" },
  ]) {
    const policy = resolveShopCatalogCachePolicy(input(overrides));
    assert.equal(policy.shareable, false);
    assert.equal(policy.cacheControl, "private, no-store");
    assert.equal(policy.reason, overrides.reason);
  }
});

test("customer and B2B audiences never share a public response", () => {
  for (const overrides of [
    { hasCustomerSession: true, reason: "customer_session" },
    { audience: "customer" as const, reason: "customer_session" },
    { isB2b: true, reason: "b2b_audience" },
  ]) {
    const policy = resolveShopCatalogCachePolicy(input(overrides));
    assert.equal(policy.shareable, false);
    assert.equal(policy.reason, overrides.reason);
  }
});

test("cache key includes audience-neutral dimensions and published version", () => {
  const first = buildShopCatalogCacheKey({
    route: "search",
    locale: "ua",
    country: "UA",
    currency: "USD",
    queryFingerprint: "make=bmw&model=m5",
    publishedVersion: 7,
  });
  const second = buildShopCatalogCacheKey({
    route: "search",
    locale: "ua",
    country: "UA",
    currency: "USD",
    queryFingerprint: "make=bmw&model=m5",
    publishedVersion: 8,
  });
  assert.match(first, /^shop-catalog-v2:search:ua:ua:USD:make=bmw&model=m5:7$/);
  assert.notEqual(first, second);
});

test("cache key rejects malformed versions and unbounded/control input", () => {
  assert.throws(
    () =>
      buildShopCatalogCacheKey({
        route: "search",
        locale: "ua",
        queryFingerprint: "\nsecret",
        publishedVersion: "1",
      }),
    /queryFingerprint is invalid/
  );
  assert.throws(
    () =>
      buildShopCatalogCacheKey({
        route: "search",
        locale: "ua",
        queryFingerprint: "q",
        publishedVersion: "01x",
      }),
    /publishedVersion must be an unsigned decimal integer/
  );
});
