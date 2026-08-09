import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShopAiCatalogQuery,
  buildShopAiLexicalWebsearchQuery,
  diversifyShopAiProducts,
  evaluateShopAiProductVehicleFitment,
  filterShopAiProductsForStock,
  filterShopAiProductsForVehicle,
  hasDirectShopAiCatalogTitleMatch,
  selectShopAiDirectCatalogTitleMatches,
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

test("assistant treats a requested brand as a soft preference", () => {
  const products = [
    product("remus-1", "Remus"),
    product("akra-1", "AKRAPOVIC"),
    product("remus-2", "Remus"),
  ];

  assert.deepEqual(
    diversifyShopAiProducts(products, "Show me Remus exhausts").map((item) => item.id),
    ["remus-1", "akra-1", "remus-2"]
  );
});

test("assistant applies a requested brand as hard only when the user says only", () => {
  const products = [
    product("remus-1", "Remus"),
    product("akra-1", "AKRAPOVIC"),
    product("remus-2", "Remus"),
  ];

  assert.deepEqual(
    diversifyShopAiProducts(products, "Show only Remus exhausts").map((item) => item.id),
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
      goal: null,
      category: "exhaust",
      searchQuery: "порівняй найкращі вихлопи для цього авто",
      minPrice: null,
      maxPrice: null,
      needsClarification: false,
      clarification: null,
    }),
    "BMW M5 G90"
  );
});

test("assistant catalog query keeps product intent without over-constraining inferred engine", () => {
  assert.equal(
    buildShopAiCatalogQuery({
      intent: "recommend",
      vehicle: {
        type: "car",
        make: "Audi",
        model: "RS6",
        chassis: "C8",
        year: null,
        engine: "EA825",
      },
      goal: "power",
      category: "performance",
      searchQuery: "Audi RS6 C8",
      minPrice: null,
      maxPrice: null,
      productKind: "turbo_inlet",
      needsClarification: false,
      clarification: null,
    }),
    "Audi RS6 C8 Turbo inlet"
  );
});

test("assistant lexical query keeps distinctive product-title terms and drops wrappers", () => {
  const plan = {
    intent: "recommend" as const,
    vehicle: {
      type: "unknown" as const,
      make: null,
      model: null,
      chassis: null,
      year: null,
      engine: null,
    },
    goal: "cooling" as const,
    category: "cooling" as const,
    searchQuery: 'Find DO88 Blue Silicone Hose 4 - 4.25" in cooling upgrade',
    minPrice: null,
    maxPrice: null,
    brand: "DO88",
    needsClarification: true,
    clarification: "Tell me the vehicle",
  };

  const query = buildShopAiLexicalWebsearchQuery(plan, plan.searchQuery);

  assert.match(query, /do88 OR blue OR silicone OR hose/);
  assert.doesNotMatch(query, /(?:^| OR )(?:find|product|show)(?: OR |$)/);
});

test("assistant recognizes a direct localized catalog-title lookup", () => {
  assert.equal(
    hasDirectShopAiCatalogTitleMatch(
      "Покажи: Накладка капота Urban Visual Carbon Fibre для Range Rover Sport L494",
      [
        {
          name: "Накладка капота Urban Visual Carbon Fibre для Range Rover Sport L494",
        },
      ]
    ),
    true
  );
  assert.equal(
    hasDirectShopAiCatalogTitleMatch("Покажи карбон для Range Rover", [
      {
        name: "Накладка капота Urban Visual Carbon Fibre для Range Rover Sport L494",
      },
    ]),
    false
  );
});

test("an availability question returns an explicitly named out-of-stock product", () => {
  const named = {
    ...product("named", "OHLINS"),
    name: "OHLINS BMV MU31 Advanced Trackday Shock Absorber Kit",
    inStock: false,
  };
  const other = { ...product("other", "OHLINS"), inStock: true };

  assert.deepEqual(
    filterShopAiProductsForStock(
      [named, other],
      "Is OHLINS BMV MU31 Advanced Trackday Shock Absorber Kit in stock?",
      true
    ).map((item) => item.id),
    ["named"]
  );
  assert.deepEqual(
    filterShopAiProductsForStock([named, other], "Show only in-stock OHLINS kits", true).map(
      (item) => item.id
    ),
    ["other"]
  );
});

test("direct-title matching drops a shorter title nested inside the intended product name", () => {
  const products = [
    { name: "Lower front bumper apron for Lamborghini Urus" },
    { name: "Two-piece lower front bumper apron for Lamborghini Urus S with OEM splitter" },
    { name: "Rear diffuser for Lamborghini Urus S" },
  ];
  const message =
    "Compare Two-piece lower front bumper apron for Lamborghini Urus S with OEM splitter and Rear diffuser for Lamborghini Urus S";

  assert.deepEqual(
    selectShopAiDirectCatalogTitleMatches(message, products).map((item) => item.name),
    [
      "Two-piece lower front bumper apron for Lamborghini Urus S with OEM splitter",
      "Rear diffuser for Lamborghini Urus S",
    ]
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
    goal: null,
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
    goal: null,
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

test("assistant correlates make, model, chassis and year in one application", () => {
  const f80 = {
    ...product("f80", "AKRAPOVIC"),
    fitments: [
      {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["F80"],
        yearRanges: [{ from: 2014, to: 2020 }],
      },
    ],
  };
  const wrongModel = {
    ...product("f82", "AKRAPOVIC"),
    fitments: [
      {
        make: "BMW",
        models: ["M4"],
        chassisCodes: ["F82"],
        yearRanges: [{ from: 2014, to: 2020 }],
      },
    ],
  };
  const plan = {
    intent: "recommend" as const,
    vehicle: {
      type: "car" as const,
      make: "BMW",
      model: "M3",
      chassis: "F80",
      year: 2018,
      engine: null,
    },
    goal: null,
    category: "exhaust" as const,
    searchQuery: "BMW M3 F80 2018 exhaust",
    minPrice: null,
    maxPrice: null,
    needsClarification: false,
    clarification: null,
  };

  assert.deepEqual(
    filterShopAiProductsForVehicle([wrongModel, f80], plan).map((item) => item.id),
    ["f80"]
  );
});

test("missing year evidence stays reviewable while an explicit year conflict is rejected", () => {
  const unknownYear = {
    ...product("unknown-year", "AKRAPOVIC"),
    fitments: [
      {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["F80"],
        yearRanges: [],
        confidence: "high" as const,
      },
    ],
  };
  const conflictingYear = {
    ...product("old", "Remus"),
    fitments: [
      {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["F80"],
        yearRanges: [{ from: 2014, to: 2017 }],
        confidence: "high" as const,
      },
    ],
  };
  const plan = {
    intent: "recommend" as const,
    vehicle: {
      type: "car" as const,
      make: "BMW",
      model: "M3",
      chassis: "F80",
      year: 2018,
      engine: null,
    },
    goal: null,
    category: "exhaust" as const,
    searchQuery: "BMW M3 F80 2018 exhaust",
    minPrice: null,
    maxPrice: null,
    needsClarification: false,
    clarification: null,
  };

  assert.equal(evaluateShopAiProductVehicleFitment(unknownYear, plan).status, "unknown");
  assert.equal(evaluateShopAiProductVehicleFitment(conflictingYear, plan).status, "contradiction");
  assert.deepEqual(
    filterShopAiProductsForVehicle([conflictingYear, unknownYear], plan).map((item) => item.id),
    ["unknown-year"]
  );
});
