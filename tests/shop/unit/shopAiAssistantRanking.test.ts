import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopAiCatalogQuery,
  diversifyShopAiProducts,
  filterShopAiProductsForVehicle,
} from "../../../src/lib/shopAiAssistantRanking";
import type { ShopAiProduct } from "../../../src/lib/shopAiAssistantTypes";

function product(id: string, brand: string): ShopAiProduct {
  return {
    id,
    brand,
    name: id,
    partNumber: id,
    description: "",
    thumbnail: null,
    inStock: true,
    price: 100,
    slug: id,
    variantId: null,
    turn14Id: "",
  };
}

test("assistant alternates brands from a relevance-ordered candidate pool", () => {
  const products = [
    product("remus-1", "Remus"),
    product("remus-2", "Remus"),
    product("remus-3", "Remus"),
    product("akra-1", "AKRAPOVIC"),
    product("akra-2", "AKRAPOVIC"),
  ];

  assert.deepEqual(
    diversifyShopAiProducts(products, "best exhaust").map((item) => item.id),
    ["remus-1", "akra-1", "remus-2", "akra-2", "remus-3"]
  );
});

test("assistant respects an explicitly requested brand", () => {
  const products = [
    product("remus-1", "Remus"),
    product("akra-1", "AKRAPOVIC"),
    product("remus-2", "Remus"),
  ];

  assert.deepEqual(
    diversifyShopAiProducts(products, "Show me Remus exhausts").map((item) => item.id),
    ["remus-1", "remus-2"]
  );
});

test("assistant catalog query excludes conversational filler", () => {
  assert.equal(
    buildShopAiCatalogQuery({
      intent: "compare",
      vehicle: {
        type: "car",
        make: "BMW",
        model: "M5",
        chassis: "G90",
        year: null,
        engine: null,
      },
      category: "exhaust",
      searchQuery: "порівняй найкращі вихлопи для цього авто",
      minPrice: null,
      maxPrice: null,
      needsClarification: false,
      clarification: null,
    }),
    "BMW M5 G90 exhaust"
  );
});

test("assistant excludes products for a conflicting chassis", () => {
  const g90 = {
    ...product("g90", "AKRAPOVIC"),
    name: "Exhaust for BMW M5 G90 / G99",
    fitments: [{ make: "BMW", models: ["M5"], chassisCodes: ["G90", "G99"] }],
  };
  const f90 = {
    ...product("f90", "iPE exhaust"),
    name: "Exhaust for BMW M5 F90",
    fitments: [{ make: "BMW", models: ["M5"], chassisCodes: ["F90"] }],
  };
  const plan = {
    intent: "recommend" as const,
    vehicle: {
      type: "car" as const,
      make: "BMW",
      model: "M5",
      chassis: "G90",
      year: null,
      engine: null,
    },
    category: "exhaust" as const,
    searchQuery: "BMW M5 G90 exhaust",
    minPrice: null,
    maxPrice: null,
    needsClarification: false,
    clarification: null,
  };

  assert.deepEqual(
    filterShopAiProductsForVehicle([f90, g90], plan).map((item) => item.id),
    ["g90"]
  );
});

test("assistant requires explicit chassis evidence when fitment data is missing", () => {
  const g90 = { ...product("g90-text", "Remus"), name: "Sport exhaust for BMW M5 G90" };
  const unknown = { ...product("unknown", "Remus"), name: "Sport exhaust for BMW M5" };
  const plan = {
    intent: "recommend" as const,
    vehicle: {
      type: "car" as const,
      make: "BMW",
      model: "M5",
      chassis: "G90",
      year: null,
      engine: null,
    },
    category: "exhaust" as const,
    searchQuery: "BMW M5 G90 exhaust",
    minPrice: null,
    maxPrice: null,
    needsClarification: false,
    clarification: null,
  };

  assert.deepEqual(
    filterShopAiProductsForVehicle([unknown, g90], plan).map((item) => item.id),
    ["g90-text"]
  );
});
