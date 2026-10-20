import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCtCarbonProductPayload,
  buildCtCarbonSlug,
  calculateCtCarbonPriceUsd,
  ctCarbonCategory,
  ctCarbonDelivery,
  ctCarbonPackage,
  ctCarbonProductType,
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

test("parts a kit says it does not include are not counted", () => {
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THIS KIT (4 ITEMS):",
      "Splitter",
      "Side Skirts",
      "Diffuser",
      "Roof Spoiler",
      "This kit does not include the Middle Spoiler.",
      "Designed by our in-house team",
    ]),
    ["splitter", "sideSkirts", "diffuser", "spoiler"]
  );
  // Never more parts than the heading states.
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THE KIT (2 ITEMS)",
      "Front Splitter",
      "Side Skirts",
      "Rear Spoiler (sold as an option)",
    ]),
    ["splitter", "sideSkirts"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "Full CT Carbon kit designed in-house for the new Audi RS3 8Y Sportback. The kit features:",
      "Ultra-aggressive 3-piece diffuser",
      "Side skirt extensions",
      "Aggressive 4-piece design splitter",
      "THIS KIT DOES NOT COME WITH A SPOILER",
    ]),
    ["diffuser", "sideSkirts", "splitter"]
  );
  // A note ends the list even when it mentions parts of the car, unless they are in the kit.
  assert.deepEqual(
    parseCtCarbonKitList([
      "This kit is comprised of the following parts",
      "3-Piece Splitter",
      "Spoiler",
      "Please note that we will provide you with rubbers which need to be fitted to your bootlid to avoid it damaging the spoiler.",
    ]),
    ["splitter", "spoiler"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "CT Carbon full kit for the BMW G01 X3, the kit includes:",
      "Gloss Black Splitter",
      "Please Note: The Exhaust tips within this kit need to be welded onto your vehicle.",
    ]),
    ["splitter", "medium"]
  );
});

test("trim kits count handles and plate holders", () => {
  assert.deepEqual(
    parseCtCarbonKitList([
      "Full black trim kit for Range Rover Vogue L405 replacing all original chrome.",
      "Kit Includes:",
      "Front Grille",
      "Door Trims",
      "Door handles",
      "Number plate holder",
      "Mirror covers",
    ]),
    ["medium", "small", "small", "small", "small"]
  );
});

test("dress-up kits and 'composed of' lists count every piece", () => {
  const dressUp = ctCarbonDelivery({
    productType: "Accessories",
    title: "BMW M2 M3 & M4 G87/G80/G81/G82/G83 CARBON FIBRE ENGINE DRESS UP KIT - V2",
    tags: [],
    bodyParagraphs: [
      "The CT Carbon engine bay dress-up kit, all made from high-quality genuine carbon fibre. Featuring the following pieces:",
      "Carbon Fibre Strut Brace",
      "Carbon Fibre Engine Cover",
    ],
  });
  assert.deepEqual(dressUp.parts, ["spoiler", "medium"]);
  assert.deepEqual(
    parseCtCarbonKitList([
      "CT Carbon full kit for the BMW G01 X3, made from ABS plastic & finished in GLOSS BLACK. Composed of the following:",
      "Gloss Black Splitter",
      "Gloss Black Side Skirts",
      "Gloss Black Diffuser",
      "Gloss Black Spoiler",
      "Please Note: The Exhaust tips within this kit need to be welded onto your vehicle.",
    ]),
    ["splitter", "sideSkirts", "diffuser", "spoiler", "medium"]
  );
});

test("the product type follows the corrected part, so Nova Poshta sizes it right", () => {
  const typeOf = (productType: string, title: string) =>
    ctCarbonProductType({ productType, title, tags: [], bodyParagraphs: [] }).productType;
  assert.equal(
    typeOf("Spoiler", "AUDI R8 V10 GEN 2.5 CARBON FIBRE FRONT CANARDS - V2"),
    "Accessories"
  );
  assert.equal(typeOf("Splitter", "ROLLS ROYCE CULLINAN CARBON FIBRE SIDE SKIRTS"), "Side Skirts");
  assert.equal(
    typeOf("Splitter", "ROLLS ROYCE CULLINAN CARBON FIBRE WHEEL ARCH EXTENSIONS"),
    "Fender Arches"
  );
  assert.equal(
    typeOf("Front End Pack", "LAND ROVER DEFENDER L663 2020+ GLOSS BLACK FRONT BUMPER TRIM"),
    "Accessories"
  );
  assert.equal(typeOf("Spoiler", "BMW G80 M3 CARBON FIBRE SPOILER - V12"), "Spoiler");
  assert.equal(typeOf("Kit", "BMW G80 M3 FULL CARBON FIBRE KIT - V25"), "Body Kit");
});

test("a kit line is the part it names first, not the vents on it", () => {
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THE KIT (2 ITEMS)",
      "Bonnet/Hood - replacing the OEM bonnet with a Carbon Fibre version which includes an air vent.",
      "Front Fenders/Wings - replacing the OEM wing with an aggressive Carbon Fibre version which include air vents.",
      "Designed in house by our team",
    ]),
    ["panel", "panel"]
  );
});

test("a kit-type product whose title names one part is that part", () => {
  const trim = ctCarbonDelivery(
    product({
      productType: "Front End Pack",
      title: "LAND ROVER DEFENDER L663 2020+ GLOSS BLACK FRONT BUMPER TRIM",
      tags: [],
      bodyParagraphs: [
        "BLAK by CT Carbon brings you this high-quality, gloss black front bumper trim for the 2020+ Land Rover Defender 90 & 110, made from high-quality ABS plastic and finished in gloss black.",
      ],
    })
  );
  assert.equal(trim.basis, "part");
  assert.deepEqual(trim.parts, ["small"]);
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
  const kitTitle = (title: string) =>
    ctCarbonDelivery(product({ title, tags: [], bodyParagraphs: [] })).parts;
  const bumpers = ctCarbonDelivery(
    product({
      title: "BMW F87 M2 CARBON FIBRE BUMPER REPLACEMENTS",
      tags: ["FRONT BUMPER", "REAR BUMPER"],
      bodyParagraphs: [],
      variants: [{ ...product().variants[0], priceExVatGbp: 2999.17 }],
    })
  );
  assert.deepEqual(bumpers.parts, ["panel", "panel"]);
  assert.equal(calculateCtCarbonPriceUsd(ctCarbonSitePriceGbp(2999.17), bumpers), 6700);
  assert.deepEqual(kitTitle("LAND ROVER DEFENDER L663 110 GLOSS BLACK ANTI SCRATCH TRIM SET"), [
    "medium",
  ]);
  assert.deepEqual(kitTitle("LAND ROVER DEFENDER L663 90 GLOSS BLACK MOULDING TRIM PACK"), [
    "sideSkirts",
  ]);
});

test("kit lists count whole bumpers, ducts and wing risers", () => {
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THE KIT:",
      "Front Bumper",
      "Grilles, Air Vents and Trims",
      "Wide Arches",
      "Exhaust Tips",
      "Door Trims",
      "Rear Bumpers",
      "Please note that some parts will require to be painted to match the colour of the car.",
    ]),
    ["panel", "medium", "panel", "medium", "small", "panel"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "This Package Consists Of:",
      "BMW Carbon Fibre Splitter - V3 By CT",
      "BMW Carbon Fibre Ducts - MP Style",
      "BMW Carbon Fibre Grille - CSL Style (Non-ACC)",
    ]),
    ["splitter", "small", "medium"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THIS KIT (7 ITEMS):",
      "Splitter",
      "Front Intake Panel",
      "Side Skirts",
      "Rear Bumper Trim",
      "Diffuser",
      "Wing",
      "Wing Risers",
      "The wing height with these risers is approximately 29 millimeters.",
    ]),
    ["splitter", "medium", "sideSkirts", "small", "diffuser", "spoiler", "small"]
  );
  assert.deepEqual(
    parseCtCarbonKitList([
      "INCLUDED IN THE KIT (7 ITEMS)",
      "Splitter",
      "Front Bumper Trim",
      "Arch Extensions",
      "Side Skirts",
      "Diffuser with tips",
      "Middle Spoiler",
      "Roof Spoiler",
    ]),
    ["splitter", "small", "panel", "sideSkirts", "diffuser", "spoiler", "spoiler"]
  );
});

test("a title naming another part beats CT's product type, of small titles only add-ons", () => {
  const cases: Array<[string, string, string]> = [
    ["Splitter", "ROLLS ROYCE CULLINAN CARBON FIBRE SIDE SKIRTS - CT DESIGN", "sideSkirts"],
    ["Splitter", "HYUNDAI i30N CARBON FIBRE DIFFUSER (PRE-FACELIFT) - CT DESIGN", "diffuser"],
    ["Splitter", "BMW U11 X1 2023+ GLOSS BLACK SPOILER", "spoiler"],
    ["Splitter", "ROLLS ROYCE CULLINAN CARBON FIBRE WHEEL ARCH EXTENSIONS - CT DESIGN", "panel"],
    ["Spoiler", "AUDI TTRS QUATTRO MK3 2015-2020 CARBON FIBRE SPLITTER", "splitter"],
    ["Side Skirts", "BMW G82 & G83 M4 2021+ GLOSS BLACK REAR BUMPER CORNERS", "medium"],
    ["Bumper Trim", "PORSCHE 911 992.1 GT3 CARBON FIBRE FRONT INTAKE PANEL - CT DESIGN", "medium"],
    ["Spoiler", "AUDI R8 V10 GEN 2.5 2020-2023 CARBON FIBRE FRONT CANARDS - V2", "small"],
    ["Spoiler", "PORSCHE 911 GT2 RS/GT3 RS WING RISERS - BLACK - CT DESIGN", "small"],
    // The title also names the typed part, or names only a small one: the type stays.
    ["Splitter", "MERCEDES A-CLASS V177 & W177 GLOSS BLACK SPLITTER & CANARDS", "splitter"],
    ["Spoiler", "PORSCHE 911 992.1 GT3 2022-2024 CARBON FIBRE WING WITH RISERS", "spoiler"],
    ["Roof Scoop", "LAMBORGHINI REVUELTO CARBON FIBRE ENGINE COVER & ROOF SCOOP", "panel"],
    ["Splitter", "FERRARI F8 2019-2023 FRONT BUMPER CARBON FIBRE TRIM", "splitter"],
  ];
  for (const [productType, title, expected] of cases) {
    assert.deepEqual(part(productType, title).parts, [expected], title);
  }
});

test("part types without a bot quote use the closest size class", () => {
  assert.deepEqual(part("Custom Steering Wheels", "MERCEDES-BENZ CUSTOM STEERING WHEEL").parts, [
    "medium",
  ]);
  assert.deepEqual(part("Bonnet", "LAND ROVER DEFENDER CARBON FIBRE HOOD").parts, ["panel"]);
  assert.deepEqual(part("Accessories", "BMW M2 M3 M4 CARBON FIBRE HUD COVER").parts, ["small"]);
  assert.deepEqual(part("", "BMW G01 X3 LCI YELLOW ADAPTIVE DRL MODULE SET").parts, ["small"]);
});

test("long, bulky or panel-mounted accessories get their real size class", () => {
  const cases: Array<[string, string, string]> = [
    ["Accessories", "LAND ROVER DEFENDER L663 110 ELECTRIC FOLD OUT SIDE STEPS", "sideSkirts"],
    ["Accessories", "DEFENDER 110 L663 2020+ GLOSS BLACK ROOF RAILS", "sideSkirts"],
    ["Accessories", "DEFENDER 90 L663 2020+ GLOSS BLACK CROSS BARS", "spoiler"],
    ["Accessories", "AUDI R8 COUPE 2015-2024 CARBON FIBRE STRUT BRACE", "spoiler"],
    ["Accessories", "LAND ROVER DEFENDER L663 2019+ ROOF LIGHT - V1", "spoiler"],
    ["Accessories", "LAND ROVER DEFENDER L663 110 & 90 SNORKEL", "spoiler"],
    ["Accessories", "BMW GXX/F9X FULL CARBON FIBRE SEATS BACKS", "medium"],
    ["Accessories", "LAND ROVER DEFENDER L663 90/110/130 CARBON FIBRE SIDE STORAGE BOX", "medium"],
    ["Accessories", "BMW M2C/M3/M4 (F87C F80 F82 F83) CARBON FIBRE INTAKE", "medium"],
    ["Accessories", "BMW M2 M3 & M4 G87/G80 CARBON FIBRE ENGINE DRESS UP KIT", "medium"],
    ["Accessories", "BMW G01 X3 2017-2021 DOUBLE SLAT CARBON FIBRE GRILLES", "medium"],
    ["Accessories", "AUDI R8 V10 GEN 2 2015-2019 CARBON FIBRE REAR BUMPER LOWER CORNERS", "medium"],
    ["Accessories", "NISSAN GTR R35 CARBON FIBRE BONNET HOOD SCOOPS", "small"],
    ["Fenders", "MCLAREN 750S 2017-2023+ DRY CARBON FIBRE FENDER VENTS", "small"],
    ["Fenders", "BMW F87 M2/M2C CARBON FIBRE FENDERS - CT DESIGN", "panel"],
  ];
  for (const [productType, title, expected] of cases) {
    assert.deepEqual(part(productType, title).parts, [expected], title);
  }
  // A title without a part name: the description names it.
  const extension = ctCarbonDelivery({
    productType: "Accessories",
    title: "AUDI A3 S-LINE & S3 PRE-FACELIFT 8V SALOON CARBON FIBRE REAR BUMPER EXTENSION",
    tags: [],
    bodyParagraphs: [
      "CT Carbon diffuser made from real carbon fibre to fit pre-facelift Audi A3 models",
    ],
  });
  assert.deepEqual(extension.parts, ["diffuser"]);
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
