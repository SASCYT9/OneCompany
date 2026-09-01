import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Catalog V2 hydrates only the visible page from fresh canonical product pricing", () => {
  const page = read("src/app/[locale]/shop/catalog/page.tsx");
  assert.match(page, /result\.items\.map\(\(item\) => item\.productId\)/);
  assert.match(page, /getShopProductsByIdsServer\([\s\S]*\{ fresh: true \}/);
  assert.doesNotMatch(page, /getShopProductsServer\(/);
});

test("Catalog V2 cards use the shared regional and B2B pricing engine", () => {
  const card = read("src/app/[locale]/shop/catalog/CatalogV2Server.tsx");
  const hook = read("src/components/shop/useResolvedShopPrice.ts");
  assert.match(card, /<ShopCardPriceTag/);
  assert.match(card, /initialViewerContext=\{pricingContext\}/);
  assert.doesNotMatch(card, /minPrice(?:Uah|Eur|Usd)/);
  assert.match(hook, /resolveShopPriceBands\(/);
  assert.match(hook, /europePrice/);
  assert.match(hook, /b2cCompareAt: compareAt/);
});

test("fresh bounded product reads bypass the optional Accelerate cache", () => {
  const catalog = read("src/lib/shopCatalogServer.ts");
  assert.match(catalog, /options\?: \{ fresh\?: boolean \}/);
  assert.match(catalog, /isAccelerateEnabled && !options\?\.fresh/);
});
