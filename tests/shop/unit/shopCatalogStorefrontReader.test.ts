import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const flagModule = import("../../../src/lib/shopCatalogReaderFlag.server");
const queryModule = import("../../../src/lib/shopCatalogStorefrontQuery");

test("Catalog V2 storefront reader is fail-closed and requires explicit SSR mode", async () => {
  const { resolveShopCatalogReaderFlag } = await flagModule;
  assert.deepEqual(resolveShopCatalogReaderFlag(undefined), {
    enabled: false,
    mode: "off",
    reason: "default_off",
  });
  assert.deepEqual(resolveShopCatalogReaderFlag("serve"), {
    enabled: false,
    mode: "off",
    reason: "invalid_value",
  });
  assert.deepEqual(resolveShopCatalogReaderFlag(" SSR "), {
    enabled: true,
    mode: "ssr",
    reason: "explicit_ssr",
  });
});

test("storefront query maps bounded progressive filters and a complete keyset cursor", async () => {
  const { parseShopCatalogStorefrontQuery } = await queryModule;
  assert.deepEqual(
    parseShopCatalogStorefrontQuery("ua", {
      q: "  intake  ",
      brand: ["Eventuri", "ignored"],
      make: "BMW",
      model: "M2",
      generation: "G87",
      year: "2024",
      engine: "S58",
      fuel: "petrol",
      afterRank: "12.50",
      afterProduct: "product-42",
    }),
    {
      locale: "ua",
      limit: 24,
      after: { stableRank: "12.50", productId: "product-42" },
      text: "intake",
      scope: null,
      brand: "Eventuri",
      make: "BMW",
      model: "M2",
      generation: "G87",
      year: 2024,
      engine: "S58",
      fuel: "petrol",
    }
  );
});

test("storefront query ignores malformed optional filters instead of broadening compatibility", async () => {
  const { parseShopCatalogStorefrontQuery } = await queryModule;
  const parsed = parseShopCatalogStorefrontQuery("en", {
    q: "x".repeat(257),
    year: "twenty",
    afterRank: "not-a-rank",
    afterProduct: "product-42",
  });
  assert.equal(parsed.text, null);
  assert.equal(parsed.year, null);
  assert.equal(parsed.after, null);
});

test("catalog page performs direct server query only behind the reader flag", () => {
  const source = readFileSync("src/app/[locale]/shop/catalog/page.tsx", "utf8");
  assert.match(source, /if \(!reader\.enabled\) return <StockCatalogPage \/>/);
  assert.match(source, /await connection\(\)/);
  assert.match(source, /queryShopCatalogProjection\(/);
  assert.doesNotMatch(source, /fetch\(/);
});
