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
  assert.match(source, /if \(!reader\.enabled\)/);
  assert.match(source, /redirect\(`/);
  assert.doesNotMatch(source, /stock\/page/);
  assert.match(source, /await connection\(\)/);
  assert.match(source, /queryShopCatalogProjection\(/);
  assert.match(source, /queryShopCatalogProjectionFacets\(query\)/);
  assert.match(source, /Promise\.all/);
  assert.doesNotMatch(source, /fetch\(/);
});

test("flag-off catalog is internally rewritten without coupling legacy client code to V2", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /SHOP_CATALOG_V2_READER_MODE === "ssr"/);
  assert.match(config, /source: "\/:locale\(ua\|en\)\/shop\/catalog"/);
  assert.match(config, /destination: "\/:locale\/shop\/stock"/);
});

test("SSR catalog exposes progressive GET filters and keyset continuation without client fetch", () => {
  const server = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");
  const client = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Filters.tsx", "utf8");
  assert.match(server, /<CatalogV2Filters/);
  assert.match(client, /method="get"/);
  for (const field of ["q", "brand", "make", "model", "generation", "year", "engine", "fuel"]) {
    assert.match(client, new RegExp(`name=[{\"]+${field}`));
  }
  assert.match(server, /afterRank/);
  assert.match(server, /afterProduct/);
  assert.match(server, /rel="next"/);
  assert.doesNotMatch(server, /useEffect|fetch\(/);
  assert.match(client, /useTransition/);
  assert.match(client, /AbortController/);
  assert.match(client, /180/);
  assert.match(client, /applyShopCatalogFilterChange/);
  assert.match(client, /\/api\/shop\/catalog\/suggest/);
});

test("catalog route has accessible loading, empty, and recoverable error states", () => {
  const loading = readFileSync("src/app/[locale]/shop/catalog/loading.tsx", "utf8");
  const error = readFileSync("src/app/[locale]/shop/catalog/error.tsx", "utf8");
  const server = readFileSync("src/app/[locale]/shop/catalog/CatalogV2Server.tsx", "utf8");
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aspect-square/);
  assert.match(error, /"use client"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /filters remain in the URL/);
  assert.match(server, /result\.items\.length === 0/);
});
