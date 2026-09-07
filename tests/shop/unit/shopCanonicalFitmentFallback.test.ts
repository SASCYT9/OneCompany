import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "./testHooks.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return {
        url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});

const reader = readFileSync("src/lib/shopCanonicalFitmentOptions.server.ts", "utf8");
const route = readFileSync("src/app/api/shop/stock/fitment/route.ts", "utf8");

test("fitment fallback is bounded and uses current published projection evidence", () => {
  assert.match(reader, /getBoundedPublishedFitmentOptions\(input\)/);
  assert.match(reader, /const BOUNDED_SELECTOR_VALUE_LIMIT = 2_001/);
  assert.match(
    reader,
    /projection\.\"schemaVersion\" = \$\{SHOP_CATALOG_PROJECTION_SCHEMA_VERSION\}/
  );
  assert.match(reader, /projection\.\"isPublished\" = true/);
  assert.match(reader, /clause\.\"verification\" = 'VERIFIED'/);
  assert.doesNotMatch(reader, /unknown_constraint/);
  assert.match(reader, /coverage: \"partial\"/);
  assert.match(reader, /if \(rows\.length >= BOUNDED_SELECTOR_VALUE_LIMIT\) return null/);
});

test("route preserves the existing reader-off legacy fallback", () => {
  const canonical = route.indexOf("if (canonical) return cachedJson(canonical);");
  const reader = route.indexOf("isShopCatalogReaderRequestEnabled(", canonical);
  const legacyLoader = route.indexOf("await getShopProductsWithFitments()", reader);
  assert.ok(canonical >= 0 && reader > canonical && legacyLoader > reader);
});

test("bounded reader joins each policy to its product projection source revision", async () => {
  const { getBoundedPublishedFitmentOptions } =
    await import("../../../src/lib/shopCanonicalFitmentOptions.server");
  const queries: unknown[] = [];
  const client = {
    async $queryRaw(query: unknown) {
      queries.push(query);
      return [{ value: "Audi" }];
    },
  };
  const result = await getBoundedPublishedFitmentOptions(
    {
      make: null,
      model: null,
      chassis: null,
      year: null,
      brand: null,
      scope: "auto",
      details: false,
    },
    client as never
  );
  assert.equal(result?.type, "makes");
  assert.equal(result?.meta.complete, false);
  const sql = JSON.stringify(queries[0], (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
  assert.match(sql, /sourceVersion/);
  assert.match(sql, /VERIFIED/);
  assert.doesNotMatch(sql, /UNKNOWN/);
});
