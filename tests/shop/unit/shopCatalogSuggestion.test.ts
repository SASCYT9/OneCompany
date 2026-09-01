import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { ShopCatalogCompatibilityDimension } from "@prisma/client";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const suggestionModule = import("../../../src/lib/shopCatalogSuggestion.server");

test("suggestion input is bounded, normalizes search text, and compacts SKU", async () => {
  const { normalizeShopCatalogSuggestionInput } = await suggestionModule;
  assert.deepEqual(normalizeShopCatalogSuggestionInput({ locale: "ua", query: " x " }), {
    locale: "ua",
    query: "",
    normalizedQuery: "",
    normalizedSku: "",
    scope: null,
  });
  const normalized = normalizeShopCatalogSuggestionInput({
    locale: "en",
    query: "  EVT-123 / A  ",
    scope: " auto ",
  });
  assert.equal(normalized.query, "EVT-123 / A");
  assert.equal(normalized.normalizedSku, "evt123a");
  assert.equal(normalized.scope, "auto");
  assert.throws(
    () => normalizeShopCatalogSuggestionInput({ locale: "ua", query: "x".repeat(65) }),
    /query exceeds 64/
  );
});

test("vehicle suggestions never cross-pair makes and models from different clauses", async () => {
  const { collectShopCatalogVehicleSuggestions } = await suggestionModule;
  const row = (
    clauseKey: string,
    dimension: ShopCatalogCompatibilityDimension,
    textValue: string
  ) => ({ productId: "p1", targetKey: "product:p1", clauseKey, dimension, textValue });
  const rows = [
    row("bmw", ShopCatalogCompatibilityDimension.MAKE, "BMW"),
    row("bmw", ShopCatalogCompatibilityDimension.MODEL, "M2"),
    row("audi", ShopCatalogCompatibilityDimension.MAKE, "Audi"),
    row("audi", ShopCatalogCompatibilityDimension.MODEL, "RS3"),
  ];
  const bmw = collectShopCatalogVehicleSuggestions(rows, "bmw m2");
  assert.deepEqual(
    bmw.map((item) => item.label),
    ["BMW M2"]
  );
  assert.equal(
    bmw.some((item) => item.label === "BMW RS3"),
    false
  );
  assert.equal(
    bmw.some((item) => item.label === "Audi M2"),
    false
  );
});

test("V2 suggestion path is projection-only, bounded, fail-closed, and uncached", () => {
  const service = readFileSync("src/lib/shopCatalogSuggestion.server.ts", "utf8");
  const route = readFileSync("src/app/api/shop/catalog/suggest/route.ts", "utf8");
  assert.match(service, /SHOP_CATALOG_SUGGESTION_LIMITS/);
  assert.match(service, /LIMIT \$\{SHOP_CATALOG_SUGGESTION_LIMITS\.products\}/);
  assert.match(service, /productId: \{ in: products\.map/);
  assert.match(service, /clause: \{ verification: "VERIFIED" \}/);
  assert.doesNotMatch(
    service,
    /getShopProductsWithFitments|findMany\(\{\s*where:\s*\{\s*isPublished/
  );
  assert.match(route, /if \(!isShopCatalogReaderRequestEnabled\(/);
  assert.match(route, /private, no-store/);
  assert.match(route, /status: 400/);
});
