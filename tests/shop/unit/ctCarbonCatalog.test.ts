import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCtCarbonProductPayload,
  buildCtCarbonSlug,
  calculateCtCarbonPriceUsd,
  ctCarbonCategory,
  ctCarbonDelivery,
  ctCarbonPackage,
  ctCarbonSitePriceGbp,
  ctCarbonSku,
  normalizeCtCarbonOptionName,
  parseCtCarbonKitList,
  type CtCarbonSourceProduct,
} from "../../../src/lib/ctCarbonCatalog";
import type { SupplierCopy } from "../../../src/lib/supplierCatalogCopy";

const product = (overrides: Partial<CtCarbonSourceProduct> = {}): CtCarbonSourceProduct => ({
  id: 15788646728061,
  handle: "bmw-g80-m3-full-carbon-fibre-kit-v25-ct-design",
  url: "https://www.ctcarbon.co/products/bmw-g80-m3-full-carbon-fibre-kit-v25-ct-design",
  title: "BMW G80 M3 FULL CARBON FIBRE KIT - V25 - CT DESIGN",
  vendor: "CT CARBON",
  productType: "Kit",
  tags: ["BMW", "SPLITTER", "SIDE SKIRTS", "SPOILER", "DIFFUSER"],
  optionNames: [],
  fitmentNote: "BMW G80 M3 2021+",
  bodyParagraphs: [
    "CT Carbon full kit for the new BMW M3 G80 by CT DESIGN.",
    "INCLUDED IN THE KIT (4 ITEMS)",
    "1-Piece Front Splitter V2",
    "Side Skirt Replacements V2 - replacing the black OEM side skirts from factory.",
    "Spoiler V12 - aggressive ducktail look",
    "3-Piece Diffuser V1 - replacing the OEM Diffuser/Black Parts from factory.",
    "Designed in house by our team",
  ],
  images: ["https://cdn.shopify.com/s/files/1/0307/3143/6163/files/g80-kit.jpg"],
  variants: [
    {
      id: 57784204460413,
      sku: "5140 441 649 438",
      title: "Default Title",
      options: [],
      priceExVatGbp: 2124.17,
      salePriceExVatGbp: null,
      grams: 19000,
      image: null,
    },
  ],
  updatedAt: "2026-10-20T00:00:00Z",
  ...overrides,
});

const part = (productType: string, title: string) =>
  ctCarbonDelivery({ productType, title, tags: [], bodyParagraphs: [] });

test("single parts match @OneCompany1_bot retail quotes of 20.10.2026", () => {
  const cases: Array<[string, string, number, number]> = [
    ["Spoiler", "LAMBORGHINI URUS PERFORMANTE CARBON FIBRE SPOILER", 999, 1730],
    ["Splitter", "LAMBORGHINI URUS PERFORMANTE CARBON FIBRE SPLITTER", 1999, 3290],
    ["Splitter", "BMW M3/M4 G80/G81/G82/G83 2021+ CARBON FIBRE SPLITTER - V8", 699, 1280],
    ["Bootlid", "BMW G80 M3 & G20 3 SERIES FULL CARBON FIBRE BOOTLID", 2299, 4125],
    ["Diffuser", "LAND ROVER DEFENDER L663 GLOSS BLACK DIFFUSER", 329, 740],
    ["Side Skirts", "BMW G20/G21 3 SERIES 2019+ CARBON FIBRE SIDE SKIRTS", 449, 960],
    ["Mirrors", "AUDI A3 S3 RS3 8V PRE-PREG CARBON FIBRE MIRRORS", 229, 405],
    ["Grille", "LAND ROVER DEFENDER 2020+ L663 FRONT BUMPER GRILLE", 199, 415],
  ];
  for (const [productType, title, siteGbp, botUsd] of cases) {
    assert.equal(calculateCtCarbonPriceUsd(siteGbp, part(productType, title)), botUsd, title);
  }
});

test("site price adds 20% UK VAT to the penny", () => {
  assert.equal(ctCarbonSitePriceGbp(832.5), 999);
  assert.equal(ctCarbonSitePriceGbp(1665.83), 1999);
  assert.equal(ctCarbonSitePriceGbp(6499.17), 7799);
  assert.equal(ctCarbonSitePriceGbp(29.16), 34.99);
  assert.throws(() => ctCarbonSitePriceGbp(0));
});

test("a kit adds up the delivery of the parts listed in its description", () => {
  const delivery = ctCarbonDelivery(product());
  assert.equal(delivery.basis, "kit-list");
  assert.deepEqual(delivery.parts, ["splitter", "sideSkirts", "spoiler", "diffuser"]);
  assert.equal(delivery.medykaGbp, 285);
  assert.equal(delivery.ukraineUsd, 490);
  assert.equal(calculateCtCarbonPriceUsd(2549, delivery), 4820);
});

test("an inline list after the heading is read, trims are small parts", () => {
  assert.deepEqual(
    parseCtCarbonKitList([
      "CT Carbon presents this full pre-preg V2 carbon fibre kit for the Lamborghini Urus, a 5-piece kit without arches; comprised of the following: - Carbon Fibre Splitter - Carbon Fibre Side Skirts - Carbon Fibre Diffuser - Carbon Fibre Boot Spoiler Lip - Carbon Fibre Roof Spoiler",
    ]),
    ["splitter", "sideSkirts", "diffuser", "spoiler", "spoiler"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THIS KIT (7 ITEMS):",
      "Splitter - V1",
      "Front Vent Trims",
      "Wing/Fender Trims",
      "Side Skirts",
      "Diffuser",
      "Middle Spoiler",
      "Roof Spoiler",
      "Designed by our in-house team",
    ]),
    ["splitter", "small", "small", "sideSkirts", "diffuser", "spoiler", "spoiler"]
  );
  const urus = ctCarbonDelivery(
    product({
      title: "LAMBORGHINI URUS FULL CARBON FIBRE KIT - CT DESIGN V2",
      bodyParagraphs: [
        "comprised of the following: - Carbon Fibre Splitter - Carbon Fibre Side Skirts - Carbon Fibre Diffuser - Carbon Fibre Boot Spoiler Lip - Carbon Fibre Roof Spoiler",
      ],
    })
  );
  assert.equal(calculateCtCarbonPriceUsd(7799, urus), 13120);
});

test("kits without a list fall back to tags, then to what the title names", () => {
  assert.deepEqual(ctCarbonDelivery(product({ bodyParagraphs: ["A full kit."] })).parts, [
    "splitter",
    "sideSkirts",
    "diffuser",
    "spoiler",
  ]);
  const rear = ctCarbonDelivery(
    product({ title: "BMW G87 M2 CARBON FIBRE REAR END KIT", tags: [], bodyParagraphs: [] })
  );
  assert.equal(rear.basis, "kit-title");
  assert.deepEqual(rear.parts, ["diffuser", "spoiler"]);
});

test("part types without a bot quote use the closest size class", () => {
  assert.deepEqual(part("Custom Steering Wheels", "MERCEDES-BENZ CUSTOM STEERING WHEEL").parts, [
    "medium",
  ]);
  assert.deepEqual(part("Bonnet", "LAND ROVER DEFENDER CARBON FIBRE HOOD").parts, ["panel"]);
  assert.deepEqual(part("Accessories", "BMW M2 M3 M4 CARBON FIBRE HUD COVER").parts, ["small"]);
  assert.deepEqual(part("", "BMW G01 X3 LCI YELLOW ADAPTIVE DRL MODULE SET").parts, ["small"]);
});

test("estimated package: one part's box, or a kit's parts stacked", () => {
  assert.deepEqual(ctCarbonPackage({ parts: ["small"] }), {
    weightKg: 1.5,
    lengthCm: 45,
    widthCm: 35,
    heightCm: 15,
  });
  assert.deepEqual(ctCarbonPackage(ctCarbonDelivery(product())), {
    weightKg: 26,
    lengthCm: 190,
    widthCm: 60,
    heightCm: 90,
  });
});

test("slug, SKU, category and option names", () => {
  assert.equal(
    buildCtCarbonSlug(product()),
    "ct-carbon-bmw-g80-m3-full-carbon-fibre-kit-v25-28061"
  );
  assert.equal(ctCarbonSku(product()), "CTC-15788646728061");
  assert.deepEqual(ctCarbonCategory(product()), {
    ua: "Карбонова аеродинаміка",
    en: "Carbon aero",
  });
  assert.deepEqual(
    ctCarbonCategory(
      product({ vendor: "BLAK BY CT", title: "BMW G80 M3 GLOSS BLACK SIDE SKIRTS" })
    ),
    { ua: "Глянцево-чорний обвіс", en: "Gloss black styling" }
  );
  assert.equal(normalizeCtCarbonOptionName("FINISH"), "Finish");
  assert.equal(
    normalizeCtCarbonOptionName("Do You Have The Factory Aero Pack?"),
    "Factory Aero Pack"
  );
});

test("payload is a USD-priced pre-order draft with the price decision recorded", () => {
  const copy = {
    titleUa: "CT Carbon — карбоновий повний обвіс для BMW M3 G80 (2021+), V25",
    titleEn: "CT Carbon BMW M3 G80 (2021+) Carbon Fibre Full Kit V25",
    shortDescUa: "Повний обвіс.",
    shortDescEn: "Full kit.",
    introUa: ["Перший абзац.", "Другий абзац."],
    introEn: ["First paragraph.", "Second paragraph."],
    keyPointsUa: ["Препрег-карбон"],
    keyPointsEn: ["Pre-preg carbon"],
    specsUa: [],
    specsEn: [],
    inBoxUa: [],
    inBoxEn: [],
    fitmentUa: ["BMW M3 G80 (2021+)"],
    fitmentEn: ["BMW M3 G80 (2021+)"],
    importantUa: [],
    importantEn: [],
    seoTitleUa: "CT Carbon обвіс BMW M3 G80",
    seoTitleEn: "CT Carbon BMW M3 G80 full kit",
    seoDescriptionUa: "Опис.",
    seoDescriptionEn: "Description.",
    imageAltUa: "CT Carbon обвіс BMW M3 G80",
    imageAltEn: "CT Carbon BMW M3 G80 kit",
    vehicles: [
      {
        make: "BMW",
        model: "M3",
        chassisCode: "G80",
        engine: null,
        yearFrom: 2021,
        yearTo: null,
        market: null,
        note: null,
      },
    ],
  } as SupplierCopy;
  const payload = buildCtCarbonProductPayload(product(), copy, "2026-10-20T00:00:00Z");
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.isPublished, false);
  assert.equal(payload.stock, "preOrder");
  assert.equal(payload.priceSourceCurrency, "USD");
  assert.equal(payload.priceUsd, 4820);
  assert.equal(payload.variants[0].priceUsd, 4820);
  assert.equal(payload.variants[0].sku, "CTC-15788646728061");
  assert.equal(payload.weight, 26);
  assert.equal(payload.length, 190);
  assert.equal(payload.isDimensionsEstimated, true);
  assert.equal(payload.variants[0].weight, 26);
  assert.equal(payload.variants[0].weightUnit, "kg");
  assert.ok(payload.tags.includes("CT Carbon"));
  const pricing = JSON.parse(
    payload.metafields.find((field) => field.key === "pricing")?.value ?? "{}"
  );
  assert.equal(pricing.variants[0].sitePriceGbp, 2549);
  assert.equal(pricing.delivery.basis, "kit-list");
});
