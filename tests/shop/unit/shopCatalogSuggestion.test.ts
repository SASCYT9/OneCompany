import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "./testHooks.mjs";
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
    () => normalizeShopCatalogSuggestionInput({ locale: "ua", query: "x".repeat(1025) }),
    /query exceeds 1024/
  );
});

test("suggestion input canonicalizes Cyrillic vehicle make aliases", async () => {
  const { normalizeShopCatalogSuggestionInput } = await suggestionModule;
  const normalized = normalizeShopCatalogSuggestionInput({ locale: "ua", query: " бмв G20 " });
  assert.equal(normalized.query, "бмв G20");
  assert.equal(normalized.normalizedQuery, "bmw g20");
  assert.equal(normalized.normalizedSku, "g20");
});

test("brand aliases normalize text without rewriting primary or variant SKU codes", async () => {
  const { normalizeShopCatalogSuggestionInput } = await suggestionModule;
  for (const [query, sku] of [
    ["BMS 6W00", "bms6w00"],
    ["BM3-LIC-S55", "bm3lics55"],
  ]) {
    assert.equal(normalizeShopCatalogSuggestionInput({ locale: "ua", query }).normalizedSku, sku);
  }
});

test("projection suggestions canonicalize brand and model spelling combinations", async () => {
  const { normalizeShopCatalogSuggestionInput } = await suggestionModule;
  for (const query of ["FiExhaust RS Q8", "Fi-Exhaust RS-Q8", "Fi Exhaust RSQ 8"]) {
    assert.equal(
      normalizeShopCatalogSuggestionInput({ locale: "ua", query }).normalizedQuery,
      "fi exhaust rsq8"
    );
  }
  assert.equal(
    normalizeShopCatalogSuggestionInput({ locale: "en", query: "Fi S Q8" }).normalizedQuery,
    "fi sq8"
  );
});

test("structured vehicle suggestions reuse specific verified fitment constraints", async () => {
  const {
    getShopCatalogSuggestionTextQuery,
    getShopCatalogSuggestionVehicleConstraints,
  } = await suggestionModule;
  assert.deepEqual(getShopCatalogSuggestionVehicleConstraints("AMG G63 W465"), {
    make: "Mercedes-Benz",
    model: "G-Class",
    generation: "W465",
    year: null,
    engine: null,
    fuel: null,
    opfGpf: null,
  });
  assert.deepEqual(getShopCatalogSuggestionVehicleConstraints("BMW M3 G80 Eventuri"), {
    make: "BMW",
    model: "M3",
    generation: "G80",
    year: null,
    engine: null,
    fuel: null,
    opfGpf: null,
  });
  assert.equal(getShopCatalogSuggestionVehicleConstraints("BMW G8X"), null);
  assert.equal(getShopCatalogSuggestionTextQuery("AMG G63 W465"), "G63 AMG");
  assert.equal(getShopCatalogSuggestionTextQuery("BMW M3 G80 Eventuri"), "eventuri");
  assert.equal(getShopCatalogSuggestionTextQuery("BMW G8X"), "BMW G8X");
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

test("vehicle suggestions accept reordered normalized query tokens", async () => {
  const { collectShopCatalogVehicleSuggestions } = await suggestionModule;
  const row = (
    clauseKey: string,
    dimension: ShopCatalogCompatibilityDimension,
    textValue: string
  ) => ({ productId: "p1", targetKey: "product:p1", clauseKey, dimension, textValue });
  const suggestions = collectShopCatalogVehicleSuggestions(
    [
      row("m5", ShopCatalogCompatibilityDimension.MAKE, "BMW"),
      row("m5", ShopCatalogCompatibilityDimension.MODEL, "M5"),
    ],
    "M5 BMW"
  );
  assert.deepEqual(
    suggestions.map((item) => item.label),
    ["BMW M5"]
  );
});

test("V2 suggestion path is projection-only, bounded, fail-closed, and uncached", () => {
  const service = readFileSync("src/lib/shopCatalogSuggestion.server.ts", "utf8");
  const route = readFileSync("src/app/api/shop/catalog/suggest/route.ts", "utf8");
  assert.match(service, /SHOP_CATALOG_SUGGESTION_LIMITS/);
  assert.match(service, /LIMIT \$\{SHOP_CATALOG_SUGGESTION_LIMITS\.products\}/);
  assert.match(service, /productId: \{ in: products\.map/);
  assert.match(service, /clause: \{ verification: "VERIFIED" \}/);
  assert.match(service, /buildShopCatalogProjectionVehicleCondition/);
  assert.match(service, /queryShopCatalogProjectionFacets/);
  assert.match(service, /resolveLegacyVehicleProductIds/);
  assert.match(service, /!vehicleSearchPlan\.canonical/);
  assert.match(service, /projection\."productId" IN/);
  assert.match(service, /projectionConditions\.push\(vehicleCondition\)/);
  assert.match(service, /normalizedProductQuery[\s\S]*Prisma\.sql`TRUE`/);
  assert.doesNotMatch(
    service,
    /getShopProductsWithFitments|findMany\(\{\s*where:\s*\{\s*isPublished/
  );
  assert.match(route, /if \(!isShopCatalogReaderRequestEnabled\(/);
  assert.match(route, /private, no-store/);
  assert.match(route, /status: 400/);
});
