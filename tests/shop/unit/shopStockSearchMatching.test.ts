import test from "node:test";
import assert from "node:assert/strict";
import { buildShopSearchText, tokenizeShopSearchQuery } from "../../../src/lib/shopSearch";
import { expandVehicleAliases, parseVehicleSearchQuery } from "../../../src/lib/shopVehicleSearch";
import {
  computeRelevanceScoreWithReasons,
  filterShopStockSearchCandidates,
} from "../../../src/lib/shopStockSearchMatching";
import { buildShopCatalogVehicleSearchPlan } from "../../../src/lib/shopCatalogVehicleSearchPlan";

function item(title: string, sku = "TEST-SKU") {
  const text = buildShopSearchText([title]);
  return {
    titleText: text,
    searchText: text,
    skuText: sku,
    compactSkuText: sku.toLowerCase().replace(/[^a-z0-9]/g, ""),
    fitmentText: "",
    fitments: [],
    score: 1,
  };
}
test("a complete title containing digits is textual product intent, not an SKU", () => {
  for (const title of [
    "Slip-On Line — Akrapovič для BMW M440I",
    "ADRO VELOSTERNADROKIT карбон HYUNDAI Veloster N 2018-",
    "Ducati Diavel V4 Silencer Cover 96482212AA",
  ]) {
    assert.notEqual(parseVehicleSearchQuery(title), "sku");
    assert.equal(
      filterShopStockSearchCandidates(
        [item(title), item("Urban fibre unrelated")],
        expandVehicleAliases(title)
      ).length,
      1
    );
  }
});
test("a pasted title survives missing automatic fitment without admitting unrelated products", () => {
  for (const title of [
    "Rear Diffuser — Akrapovič для Porsche 911 GT3 /GT3RS (992)",
    "Mounting Kit — Akrapovič для Mercedes G500 / G550 (W463A)",
    "Evolution Link Pipe Porsche 718 Cayman GTS 4.0 / Boxster GTS 4.0",
  ]) {
    assert.deepEqual(
      filterShopStockSearchCandidates(
        [item(title), item("Unrelated Porsche 911")],
        expandVehicleAliases(title)
      ).map((x) => x.titleText),
      [item(title).titleText]
    );
  }
});
test("exact titles rank above generic fitment and description mentions", () => {
  const title = "Akrapovic BMW M3 exhaust";
  const exact = computeRelevanceScoreWithReasons(
    item(title),
    tokenizeShopSearchQuery(title),
    title,
    expandVehicleAliases(title),
    "Akrapovic",
    title
  );
  const generic = computeRelevanceScoreWithReasons(
    item("BMW M3"),
    tokenizeShopSearchQuery(title),
    title,
    expandVehicleAliases(title)
  );
  assert.ok(exact.score > generic.score);
  assert.ok(exact.reasons.includes("title:exact"));
});
test("product query terms do not become implicit selector restrictions", () => {
  const plan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams({ q: "Mounting Kit Mercedes G500 G550 W463A" })
  );
  assert.equal(plan.constraints.make, null);
  const explicit = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams({ q: "Akrapovic M3", make: "Audi", model: "RSQ8" })
  );
  assert.equal(explicit.constraints.make, "Audi");
  assert.equal(explicit.constraints.model, "RSQ8");
});
test("Turbo alone cannot infer Porsche compatibility", () => {
  assert.deepEqual(expandVehicleAliases("turbo intake").makes, []);
});

test("unstructured motorcycle matching keeps S1000R and S1000RR distinct even without exact results", () => {
  const singleR = item("Ilmberger BMW S1000R carbon");
  const doubleR = item("Ilmberger BMW S1000RR carbon");
  for (const query of ["Ilmberger S1000R", "Ilmberger S 1000 R"]) {
    assert.deepEqual(filterShopStockSearchCandidates([doubleR], expandVehicleAliases(query)), []);
    assert.deepEqual(
      filterShopStockSearchCandidates([singleR, doubleR], expandVehicleAliases(query)),
      [singleR]
    );
  }
  assert.deepEqual(
    filterShopStockSearchCandidates([singleR], expandVehicleAliases("Ilmberger S1000RR")),
    []
  );
});

test("brand abbreviations cannot match rival SKUs, while exact part numbers remain searchable", () => {
  const burger = {
    ...item("Burger Motorsports BMW M3 intake"),
    product: { brand: "Burger Motorsports" },
  };
  const ohlins = {
    ...item("OHLINS BMS 6W00 BMW M3 shock absorber", "BMS 6W00"),
    product: { brand: "OHLINS" },
  };
  assert.deepEqual(
    filterShopStockSearchCandidates([burger, ohlins], expandVehicleAliases("BMS M3")),
    [burger]
  );
  assert.deepEqual(
    filterShopStockSearchCandidates([burger, ohlins], expandVehicleAliases("BMS 6W00")),
    [ohlins]
  );
  const title = "OHLINS BMS 6W00 BMW M3 shock absorber";
  assert.deepEqual(filterShopStockSearchCandidates([burger, ohlins], expandVehicleAliases(title)), [
    ohlins,
  ]);
});

test("numeric and letter-only exact SKUs win over coincidental vehicle aliases", () => {
  for (const sku of [
    "217-999-296",
    "464-999-296",
    "447-666-296",
    "LM-URUS-CBOE + TIP-URUS-S",
    "MB-GTR-XPOE",
  ]) {
    const product = item("The actual product", sku);
    assert.deepEqual(
      filterShopStockSearchCandidates(
        [product, item("Ferrari 296 unrelated")],
        expandVehicleAliases(sku)
      ),
      [product]
    );
  }
});
