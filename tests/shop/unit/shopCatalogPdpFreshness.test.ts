import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("exact-slug storefront reads bypass the independent Accelerate TTL", () => {
  const source = read("src/lib/shopCatalogServer.ts");
  const lookup = source.slice(
    source.indexOf("export const lookupShopProductBySlugServer"),
    source.indexOf("export const getShopProductBySlugServer")
  );
  assert.match(lookup, /await prisma\.shopProduct\.findFirst\(queryParams\)/);
  assert.doesNotMatch(lookup, /cacheStrategy/);
  assert.doesNotMatch(lookup, /getPrismaCachedClient/);
});

test("pricing and inventory mutations invalidate only affected PDP aliases", () => {
  const helper = read("src/lib/shopStorefrontRevalidation.ts");
  assert.match(helper, /export function revalidateShopStorefrontProductDetail/);
  const detail = helper.slice(
    helper.indexOf("export function revalidateShopStorefrontProductDetail"),
    helper.indexOf("export function revalidateShopStorefrontProduct(")
  );
  assert.match(detail, /revalidateShopStorefrontProducts\(\[product\], true\)/);
  assert.doesNotMatch(detail, /revalidateTag|LISTING_SURFACE/);

  for (const route of [
    "src/app/api/admin/shop/pricing/route.ts",
    "src/app/api/admin/shop/inventory/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /storefront: variant\.product/);
    assert.match(source, /revalidateShopStorefrontProductDetail\(group\.storefront\)/);
    assert.doesNotMatch(source, /const changedProducts = await/);
    assert.match(source, /targeted PDP revalidation failed/);
  }
});

test("manual product mutations delegate storefront invalidation without duplicate path calls", () => {
  for (const route of [
    "src/app/api/admin/shop/products/route.ts",
    "src/app/api/admin/shop/products/[id]/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /revalidateShopStorefrontProduct\(/);
    assert.doesNotMatch(source, /from "next\/cache"/);
    assert.doesNotMatch(source, /buildShopStorefrontProductPath/);
  }
});

test("storefront invalidation takes legacy listing behavior from the shared route registry", () => {
  const source = read("src/lib/shopStorefrontRevalidationPlan.ts");
  assert.match(source, /getStorefrontRoute\(segment\)/);
  assert.match(source, /route\.listingSurface/);
  assert.match(source, /route\.paginated/);
  assert.doesNotMatch(source, /LISTING_SURFACE_BY_SEGMENT|PAGINATED_SEGMENTS/);
});

test("catalog invalidation evicts local and tagged Accelerate caches", () => {
  const server = read("src/lib/shopCatalogServer.ts");
  assert.match(server, /export function invalidateShopCatalogMemoryCaches/);
  assert.match(server, /shopCatalogMemoryCacheGeneration \+= 1/);
  assert.match(server, /brandProductsCache\.clear\(\)/);
  assert.match(server, /relatedProductsCache\.clear\(\)/);
  assert.match(server, /\$accelerate\.invalidate\(\{ tags: \["shop-products"\] \}\)/);
  assert.match(server, /tags: \["shop-products"\]/);
  // A query that started before invalidation may finish afterwards. It must
  // not win the cache race or erase a newer in-flight promise.
  assert.match(server, /cached\.generation === generation/);
  assert.match(server, /if \(shopCatalogMemoryCacheGeneration === generation\)/);
  assert.match(server, /brandProductsPromise\.get\(cacheKey\)\?\.promise === promise/);
  assert.match(server, /relatedProductsPromise\.get\(cacheKey\)\?\.promise === promise/);
  assert.match(server, /Accelerate cache invalidation failed/);

  const helper = read("src/lib/shopStorefrontRevalidation.ts");
  assert.match(helper, /invalidateShopCatalogCaches/);
  assert.match(helper, /void invalidateShopCatalogCaches\(\)/);
});
