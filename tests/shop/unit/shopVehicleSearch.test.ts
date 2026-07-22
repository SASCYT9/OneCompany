import test from "node:test";
import assert from "node:assert/strict";

import {
  enrichVehicleSearchFromCatalog,
  expandVehicleAliases,
  parseVehicleSearchQuery,
  scoreVehicleSearchItem,
} from "../../../src/lib/shopVehicleSearch";
import { extractVehicleYearRanges } from "../../../src/lib/shopVehicleYears";

test("G8X expands to BMW M cars and G8x chassis aliases", () => {
  const expanded = expandVehicleAliases("G8X");

  assert.equal(expanded.intent, "vehicle");
  assert.deepEqual(expanded.makes, ["BMW"]);
  assert.deepEqual(expanded.models, ["M2", "M3", "M4"]);
  assert.deepEqual(expanded.chassis, ["G80", "G81", "G82", "G83", "G87"]);
  assert.deepEqual(expanded.platforms, ["G8X"]);
});

test("Mercedes G-Wagon aliases map to G-Class and W463/W465 platforms", () => {
  for (const query of ["g wagon", "g-class", "g63"]) {
    const expanded = expandVehicleAliases(query);

    assert.equal(expanded.intent, "vehicle");
    assert.equal(expanded.makes.includes("Mercedes-Benz"), true);
    assert.equal(expanded.models.includes("G-Class"), true);
    assert.equal(expanded.chassis.includes("W463A"), true);
    assert.equal(expanded.chassis.includes("W465"), true);
  }
});

test("RSQ8 and RS Q8 normalize to the same Audi intent", () => {
  const compact = expandVehicleAliases("rsq8");
  const spaced = expandVehicleAliases("rs q8");

  assert.deepEqual(compact.makes, spaced.makes);
  assert.deepEqual(compact.models, spaced.models);
  assert.deepEqual(compact.chassis, spaced.chassis);
  assert.equal(compact.models.includes("RS Q8"), true);
});

test("structured part numbers are classified as SKU intent", () => {
  assert.equal(parseVehicleSearchQuery("S-PO/T/8"), "sku");
  assert.equal(expandVehicleAliases("S-PO/T/8").intent, "sku");
});

test("vehicle scoring ranks model and chassis matches above make-only matches", () => {
  const query = expandVehicleAliases("M3 G80");
  const exact = scoreVehicleSearchItem(
    {
      searchText: "bmw m3 g80 g81 akrapovic exhaust",
      titleText: "akrapovic exhaust for bmw m3 g80 g81",
      skuText: "s bm ti 33h",
      compactSkuText: "sbmti33h",
      fitmentText: "bmw m3 g80 g81",
    },
    query
  );
  const broad = scoreVehicleSearchItem(
    {
      searchText: "bmw universal wheel spacer",
      titleText: "bmw universal wheel spacer",
      skuText: "bmw spacer",
      compactSkuText: "bmwspacer",
      fitmentText: "bmw",
    },
    query
  );

  assert.equal(exact.score > broad.score, true);
  assert.equal(
    exact.reasons.some((reason) => reason.includes("model+chassis")),
    true
  );
});

test("specific model queries do not expand to every model in a broad alias family", () => {
  const expanded = expandVehicleAliases("BMW M3 2018");

  assert.deepEqual(expanded.models, ["M3"]);
  assert.deepEqual(expanded.years, [2018]);
});

test("specific Porsche generation and family remain exact", () => {
  const turbo = expandVehicleAliases("Porsche 911 Turbo 991.2 2018");
  const carrera = expandVehicleAliases("Porsche 911 Carrera 992.1 2021");

  assert.deepEqual(turbo.models, ["911 Turbo"]);
  assert.deepEqual(turbo.chassis, ["991.2"]);
  assert.deepEqual(carrera.models, ["911 Carrera"]);
  assert.deepEqual(carrera.chassis, ["992.1"]);

  const enriched = enrichVehicleSearchFromCatalog(turbo, [
    {
      titleText: "porsche 911 turbo 991 exhaust",
      fitment: {
        make: "Porsche",
        models: ["911 Turbo"],
        chassisCodes: ["991"],
        yearRanges: [{ from: 2011, to: 2019 }],
      },
    },
    {
      titleText: "porsche 911 turbo 991 2 exhaust",
      fitment: {
        make: "Porsche",
        models: ["911 Turbo"],
        chassisCodes: ["991.2"],
        yearRanges: [{ from: 2016, to: 2019 }],
      },
    },
  ]);
  assert.deepEqual(enriched.chassis, ["991.2"]);
});

test("specific GR Supra model wins over the shorter Supra alias", () => {
  assert.deepEqual(expandVehicleAliases("Toyota GR Supra A90 2021").models, ["GR Supra"]);
});

test("catalog mentions remove unrelated makes and models from overlapping aliases", () => {
  const enriched = enrichVehicleSearchFromCatalog(expandVehicleAliases("Audi RS3 8Y 2023"), [
    {
      titleText: "audi rs3 8y exhaust",
      fitment: {
        make: "Audi",
        models: ["RS3"],
        chassisCodes: ["8Y"],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
    {
      titleText: "volkswagen golf mk8 exhaust",
      fitment: {
        make: "Volkswagen",
        models: ["Golf"],
        chassisCodes: ["MK8"],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
    {
      titleText: "audi rs3 8v exhaust",
      fitment: {
        make: "Audi",
        models: ["RS3"],
        chassisCodes: ["8V"],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
  ]);

  assert.deepEqual(enriched.makes, ["Audi"]);
  assert.deepEqual(enriched.models, ["RS3"]);
  assert.deepEqual(enriched.chassis, ["8Y"]);
});

test("catalog year evidence resolves a query to matching chassis", () => {
  const expanded = expandVehicleAliases("BMW M3 2018");
  const enriched = enrichVehicleSearchFromCatalog(
    expanded,
    [
      {
        titleText: "bmw m3 f80 exhaust",
        fitment: {
          make: "BMW",
          models: ["M3"],
          chassisCodes: ["F80"],
          yearRanges: [{ from: 2014, to: 2020 }],
        },
      },
      {
        titleText: "bmw m3 g80 exhaust",
        fitment: {
          make: "BMW",
          models: ["M3"],
          chassisCodes: ["G80"],
          yearRanges: [{ from: 2021, to: null }],
        },
      },
    ],
    { isExpectedChassis: () => true }
  );

  assert.deepEqual(enriched.chassis, ["F80"]);
});

test("year-aware scoring strongly penalizes an explicit generation mismatch", () => {
  const query = expandVehicleAliases("BMW M3 2018");
  const matching = scoreVehicleSearchItem(
    {
      searchText: "bmw m3 f80 exhaust 2014 2020",
      titleText: "bmw m3 f80 exhaust 2014 2020",
      skuText: "f80 exhaust",
      compactSkuText: "f80exhaust",
      fitmentText: "bmw m3 f80 2014 2020",
      fitmentMake: "BMW",
      yearRanges: [{ from: 2014, to: 2020 }],
    },
    query
  );
  const mismatch = scoreVehicleSearchItem(
    {
      searchText: "bmw m3 g80 exhaust 2021 2026",
      titleText: "bmw m3 g80 exhaust 2021 2026",
      skuText: "g80 exhaust",
      compactSkuText: "g80exhaust",
      fitmentText: "bmw m3 g80 2021 2026",
      fitmentMake: "BMW",
      yearRanges: [{ from: 2021, to: 2026 }],
    },
    query
  );

  assert.equal(matching.score > mismatch.score * 10, true);
});

test("extracts closed, open, and short year ranges", () => {
  assert.deepEqual(extractVehicleYearRanges("2014-2020 / from 2021 / 2022-24"), [
    { from: 2014, to: 2020 },
    { from: 2021, to: null },
    { from: 2022, to: 2024 },
  ]);
  assert.deepEqual(extractVehicleYearRanges("2018+"), [{ from: 2018, to: null }]);
  assert.deepEqual(extractVehicleYearRanges("Panigale V4 з 2022"), [{ from: 2022, to: null }]);
  assert.deepEqual(extractVehicleYearRanges("Audi RS3 2022-"), [{ from: 2022, to: null }]);
});

test("catalog resolver discovers moto makes and compact model spellings", () => {
  const ducati = enrichVehicleSearchFromCatalog(expandVehicleAliases("Ducati Panigale 2022"), [
    {
      titleText: "ducati panigale v4 carbon",
      fitment: {
        make: "Ducati",
        models: ["Panigale"],
        chassisCodes: [],
        yearRanges: [{ from: 2022, to: null }],
      },
    },
  ]);
  const bmwMoto = enrichVehicleSearchFromCatalog(expandVehicleAliases("BMW S1000RR 2020"), [
    {
      titleText: "bmw s 1000 rr exhaust",
      fitment: {
        make: "BMW",
        models: ["S 1000 RR"],
        chassisCodes: [],
        yearRanges: [{ from: 2019, to: 2026 }],
      },
    },
  ]);

  assert.deepEqual(ducati.makes, ["Ducati"]);
  assert.deepEqual(ducati.models, ["Panigale"]);
  assert.equal(ducati.intent, "vehicle");
  assert.deepEqual(bmwMoto.makes, ["BMW"]);
  assert.deepEqual(bmwMoto.models, ["S 1000 RR"]);
});

test("explicit catalog make overrides a conflicting chassis alias", () => {
  const enriched = enrichVehicleSearchFromCatalog(expandVehicleAliases("Genesis G80 2024"), [
    {
      titleText: "genesis g80 2024 suspension",
      fitment: {
        make: "Genesis",
        models: ["G80"],
        chassisCodes: [],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
    {
      titleText: "bmw m3 g80 2024 exhaust",
      fitment: {
        make: "BMW",
        models: ["M3"],
        chassisCodes: ["G80"],
        yearRanges: [{ from: 2021, to: null }],
      },
    },
  ]);

  assert.deepEqual(enriched.makes, ["Genesis"]);
  assert.deepEqual(enriched.models, ["G80"]);
  assert.deepEqual(enriched.chassis, []);
});

test("engine displacement is not extracted as a model year", () => {
  assert.deepEqual(extractVehicleYearRanges("Infiniti Q50 (2013+) 2.0 T 1991cc"), [
    { from: 2013, to: null },
  ]);
});

test("catalog resolver scopes ambiguous chassis codes to an explicit make", () => {
  const catalog = [
    {
      titleText: "audi rs6 c8 intercooler 2020 2024",
      fitment: {
        make: "Audi",
        models: ["RS6"],
        chassisCodes: ["C8"],
        yearRanges: [{ from: 2020, to: 2024 }],
      },
    },
    {
      titleText: "chevrolet corvette c8 exhaust 2020 2024",
      fitment: {
        make: "Chevrolet",
        models: ["Corvette"],
        chassisCodes: ["C8"],
        yearRanges: [{ from: 2020, to: 2024 }],
      },
    },
  ];

  const audi = enrichVehicleSearchFromCatalog(expandVehicleAliases("Audi C8 2022"), catalog);
  const chevrolet = enrichVehicleSearchFromCatalog(
    expandVehicleAliases("Chevrolet C8 2022"),
    catalog
  );

  assert.deepEqual(audi.makes, ["Audi"]);
  assert.deepEqual(audi.chassis, ["C8"]);
  assert.deepEqual(chevrolet.makes, ["Chevrolet"]);
  assert.deepEqual(chevrolet.chassis, ["C8"]);
});
