import assert from "node:assert/strict";
import test from "node:test";

import {
  applyShopCatalogFilterChange,
  buildShopCatalogFilterHref,
  shopCatalogFilterStateFromQuery,
  type ShopCatalogFilterState,
} from "../../../src/lib/shopCatalogFilterTransitions";

const selected: ShopCatalogFilterState = {
  q: "intake",
  brand: "eventuri",
  category: "intake",
  make: "bmw",
  model: "m2",
  generation: "g87",
  year: "2024",
  engine: "s58",
  fuel: "petrol",
};

test("changing a parent facet clears every incompatible descendant", () => {
  assert.deepEqual(applyShopCatalogFilterChange(selected, "brand", "racechip"), {
    q: "intake",
    brand: "racechip",
    category: "intake",
    make: "",
    model: "",
    generation: "",
    year: "",
    engine: "",
    fuel: "",
  });
  assert.deepEqual(applyShopCatalogFilterChange(selected, "make", "audi"), {
    ...selected,
    make: "audi",
    model: "",
    generation: "",
    year: "",
    engine: "",
    fuel: "",
  });
  assert.deepEqual(applyShopCatalogFilterChange(selected, "engine", "b58"), {
    ...selected,
    engine: "b58",
    fuel: "",
  });
});

test("filter href is canonical, trimmed, and never carries a keyset cursor", () => {
  assert.equal(
    buildShopCatalogFilterHref("ua", { ...selected, q: "  carbon intake " }),
    "/ua/shop/catalog?q=carbon+intake&brand=eventuri&category=intake&make=bmw&model=m2&generation=g87&year=2024&engine=s58&fuel=petrol"
  );
  assert.equal(
    buildShopCatalogFilterHref("en", {
      q: "",
      brand: "",
      category: "",
      make: "",
      model: "",
      generation: "",
      year: "",
      engine: "",
      fuel: "",
    }),
    "/en/shop/catalog"
  );
});

test("SSR query becomes plain serializable client filter state", () => {
  assert.deepEqual(
    shopCatalogFilterStateFromQuery({
      locale: "ua",
      text: "intake",
      brand: "eventuri",
      category: "intake",
      year: 2024,
      after: { stableRank: "10", productId: "p10" },
    }),
    {
      q: "intake",
      brand: "eventuri",
      category: "intake",
      make: "",
      model: "",
      generation: "",
      year: "2024",
      engine: "",
      fuel: "",
      scope: null,
      stock: null,
      productType: null,
      productKind: null,
      sort: null,
      currency: null,
      minPrice: null,
      maxPrice: null,
      country: null,
      facetMode: null,
      strict: false,
      useEuropePrice: false,
    }
  );
});

test("facet changes preserve non-visual catalog query dimensions", () => {
  const state = shopCatalogFilterStateFromQuery({
    locale: "ua",
    text: "intake",
    brand: "eventuri",
    category: "intake",
    make: "bmw",
    model: "m5",
    generation: "g90",
    year: 2025,
    engine: "s68",
    fuel: "petrol",
    scope: "moto",
    stock: "inStock",
    productType: "exhaust",
    productKind: "catback",
    order: "price_desc",
    priceCurrency: "EUR",
    minPrice: 100,
    maxPrice: 500,
    country: "PL",
    facetMode: "global",
    strict: true,
    useEuropePrice: true,
  });

  const next = applyShopCatalogFilterChange(state, "make", "audi");
  assert.equal(
    buildShopCatalogFilterHref("ua", next),
    "/ua/shop/catalog?q=intake&brand=eventuri&category=intake&make=audi&scope=moto&stock=inStock&productType=exhaust&productKind=catback&sort=price_desc&currency=EUR&minPrice=100&maxPrice=500&country=PL&facetMode=global&strict=1&europePrice=1"
  );
});
