import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHolleyProductPayload,
  buildHolleySlug,
  calculateHolleyFormulaUsd,
  decideHolleyPriceUsd,
  groupHolleyVariants,
  holleyCategory,
  holleyImageUrl,
  type HolleyCollectedPage,
  type HolleyPriceListItem,
  type HolleyProductGroup,
} from "../../../src/lib/holleyBrandCatalog";
import type { SupplierCopy } from "../../../src/lib/supplierCatalogCopy";
import { parseSupplierFitmentContract } from "../../../src/lib/shopImportFitment";

function page(sku: string, extra: Partial<HolleyCollectedPage> = {}): HolleyCollectedPage {
  return {
    sku,
    url: `https://www.dinancars.com/products/exhaust/parts/${sku}`,
    name: "Dinan Free Flow Axle-Back Exhaust - 2018-2023 BMW M5",
    short: "Stainless Steel - F90",
    desc: "Description",
    features: [],
    install: "",
    notes: "",
    attrs: {},
    images: [`${sku.toLowerCase()}-1.jpg`, `${sku.toLowerCase()}-2.jpg`],
    defaultImage: `${sku.toLowerCase()}-1.jpg`,
    videos: ["9rkto3OXJns"],
    docs: [{ type: "instructions", name: "Instructions.pdf", link: "abc.pdf" }],
    category: "Exhaust Systems/Axleback Exhaust Systems",
    lifecycle: "active",
    universal: false,
    variations: [],
    ...extra,
  };
}

function priceItem(
  sku: string,
  retailUsd: number,
  mapUsd: number,
  weightLb: number
): HolleyPriceListItem {
  return {
    sku,
    category: "Axle Back Exhaust Kits",
    status: "Active",
    mapUsd,
    retailUsd,
    description: "FREEFLOW EXHAUST F90 M5",
    upc: "813725025070",
    lengthIn: 53,
    widthIn: 27,
    heightIn: 11,
    weightLb,
    countryOfOrigin: "US",
    htsCode: null,
    emissionsCode: null,
    emissionsDescription: null,
  };
}

const copy: SupplierCopy = {
  titleEn: "Dinan Free Flow Axle-Back Exhaust for BMW M5 (F90)",
  titleUa: "Dinan вихлопна система axle-back для BMW M5 (F90)",
  shortDescEn: "Axle-back exhaust.",
  shortDescUa: "Вихлоп axle-back.",
  introEn: ["One.", "Two."],
  introUa: ["Один.", "Два."],
  keyPointsEn: ["Stainless steel"],
  keyPointsUa: ["Нержавіюча сталь"],
  specsEn: [],
  specsUa: [],
  inBoxEn: [],
  inBoxUa: [],
  fitmentEn: ["BMW M5 (F90), 2018–2023"],
  fitmentUa: ["BMW M5 (F90), 2018–2023"],
  importantEn: [],
  importantUa: [],
  seoTitleEn: "Dinan Axle-Back Exhaust BMW M5 F90",
  seoTitleUa: "Dinan вихлоп axle-back BMW M5 F90",
  seoDescriptionEn: "Dinan axle-back exhaust for BMW M5 F90.",
  seoDescriptionUa: "Вихлоп Dinan axle-back для BMW M5 F90.",
  imageAltEn: "Dinan exhaust",
  imageAltUa: "Вихлоп Dinan",
  vehicles: [
    {
      make: "BMW",
      model: "M5",
      chassisCode: "F90",
      engine: "S63",
      yearFrom: 2018,
      yearTo: 2023,
      market: null,
      note: null,
    },
  ],
};

test("Dinan/APR formula is base price × 1.15 + $12 per kg of price-list pounds, up to $1", () => {
  // 3037.95 × 1.15 + 12 × 63 lb × 0.45359237 = 3836.56
  assert.equal(calculateHolleyFormulaUsd(3037.95, 63), 3837);
  assert.equal(calculateHolleyFormulaUsd(956.95, 21), 1215);
  assert.equal(calculateHolleyFormulaUsd(23.93, 0), 28);
  assert.throws(() => calculateHolleyFormulaUsd(0, 1));
});

test("Dinan/APR price starts from MAP; MSRP only when the price list has no MAP", () => {
  // Ігор, 21.10.2026: APR CI100059, MAP 2999.95, Retail 3374.95, 12 lb
  // 2999.95 × 1.15 + 12 × 12 × 0.45359237 = 3515.26
  const map = decideHolleyPriceUsd({
    retailUsd: 3374.95,
    mapUsd: 2999.95,
    weightLb: 12,
    competitorUsd: [],
  });
  assert.equal(map.priceUsd, 3516);
  const noMap = decideHolleyPriceUsd({
    retailUsd: 3374.95,
    mapUsd: null,
    weightLb: 12,
    competitorUsd: [],
  });
  assert.equal(noMap.priceUsd, 3947);
  assert.equal(noMap.floorUsd, null);
});

test("competitor prices cap the formula but never go under MAP plus shipping", () => {
  const formula = decideHolleyPriceUsd({
    retailUsd: 2081.95,
    mapUsd: 1849.95,
    weightLb: 15,
    competitorUsd: [],
  });
  assert.equal(formula.rule, "formula");
  assert.equal(formula.priceUsd, 2210);

  const capped = decideHolleyPriceUsd({
    retailUsd: 2081.95,
    mapUsd: 1849.95,
    weightLb: 15,
    competitorUsd: [2160.6, 2300],
  });
  assert.equal(capped.rule, "competitor");
  assert.equal(capped.priceUsd, 2160);

  const floored = decideHolleyPriceUsd({
    retailUsd: 1857,
    mapUsd: 1650,
    weightLb: 45,
    competitorUsd: [1336],
  });
  assert.equal(floored.rule, "floor");
  // 1650 + 12 × 45 × 0.45359237 = 1894.94 → 1895
  assert.equal(floored.priceUsd, 1895);
});

test("versions offered on the brand page become one product with variants", () => {
  const pages = new Map([
    [
      "D660-0079-BLK",
      page("D660-0079-BLK", {
        variations: [
          {
            title: "Tip Finish",
            options: [
              { label: "Black Ceramic Coated", sku: "D660-0079-BLK", disabled: false },
              { label: "Polished", sku: "D660-0079", disabled: false },
            ],
          },
        ],
      }),
    ],
    [
      "D660-0079",
      page("D660-0079", {
        variations: [
          {
            title: "Tip Finish",
            options: [
              { label: "Black Ceramic Coated", sku: "D660-0079-BLK", disabled: false },
              { label: "Polished", sku: "D660-0079", disabled: false },
            ],
          },
        ],
      }),
    ],
    ["D120-0630", page("D120-0630")],
  ]);
  const groups = groupHolleyVariants("dinan", ["D660-0079-BLK", "D120-0630", "D660-0079"], pages);
  assert.equal(groups.length, 2);
  const exhaust = groups.find((group) => group.primarySku === "D660-0079-BLK");
  assert.deepEqual(exhaust?.optionNames, ["Tip Finish"]);
  assert.deepEqual(
    exhaust?.members.map((member) => [member.sku, member.optionValues[0]]),
    [
      ["D660-0079-BLK", "Black Ceramic Coated"],
      ["D660-0079", "Polished"],
    ]
  );
  const single = groups.find((group) => group.primarySku === "D120-0630");
  assert.deepEqual(single?.optionNames, []);
});

test("brand 'Version' selectors that link different parts do not merge products", () => {
  const versions = {
    title: "Version",
    options: [
      { label: "Front Lip Spoiler", sku: "MS100236", disabled: false },
      { label: "Side Skirts", sku: "MS100240", disabled: false },
    ],
  };
  const pages = new Map([
    ["MS100236", page("MS100236", { variations: [versions] })],
    ["MS100240", page("MS100240", { variations: [versions] })],
  ]);
  const groups = groupHolleyVariants("apr", ["MS100236", "MS100240"], pages);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.optionNames.length === 0));
});

test("colour lists that point at another wheel version do not merge the versions", () => {
  const selector = (title: string, options: Array<[string, string]>) => ({
    title,
    options: options.map(([label, sku]) => ({ label, sku, disabled: false })),
  });
  // A01 wheel pages list the A02 Anthracite wheel among their colours, as goapr.com does.
  const pages = new Map([
    [
      "W1",
      page("W1", {
        variations: [
          selector("Color", [
            ["Gunmetal Grey", "W1"],
            ["Anthracite", "W3"],
          ]),
          selector("Diameter", [
            ["19 IN", "W1"],
            ["18 IN", "W2"],
          ]),
          selector("Version", [
            ["A01", "W1"],
            ["A02", "W3"],
          ]),
        ],
      }),
    ],
    [
      "W2",
      page("W2", {
        variations: [
          selector("Color", [
            ["Gunmetal Grey", "W2"],
            ["Anthracite", "W3"],
          ]),
          selector("Diameter", [
            ["19 IN", "W1"],
            ["18 IN", "W2"],
          ]),
          selector("Version", [
            ["A01", "W2"],
            ["A02", "W3"],
          ]),
        ],
      }),
    ],
    [
      "W3",
      page("W3", {
        variations: [
          selector("Color", [["Anthracite", "W3"]]),
          selector("Diameter", [
            ["18 IN", "W3"],
            ["19 IN", "W4"],
          ]),
          selector("Version", [
            ["A02", "W3"],
            ["A01", "W1"],
          ]),
        ],
      }),
    ],
    [
      "W4",
      page("W4", {
        variations: [
          selector("Color", [["Anthracite", "W4"]]),
          selector("Diameter", [
            ["18 IN", "W3"],
            ["19 IN", "W4"],
          ]),
          selector("Version", [
            ["A02", "W4"],
            ["A01", "W1"],
          ]),
        ],
      }),
    ],
  ]);
  const groups = groupHolleyVariants("apr", ["W1", "W2", "W3", "W4"], pages);
  assert.deepEqual(
    groups.map((group) => [group.primarySku, group.optionNames, group.members.map((m) => m.sku)]),
    [
      ["W1", ["Diameter"], ["W1", "W2"]],
      ["W3", ["Diameter"], ["W3", "W4"]],
    ]
  );
});

test("a family whose choices cannot tell two SKUs apart stays split", () => {
  const finish = (own: string) => ({
    title: "Finish",
    options: [
      { label: "Brushed Silver", sku: "TPK0002", disabled: false },
      { label: "Polished Silver", sku: own, disabled: false },
    ],
  });
  const pages = new Map([
    ["TPK0001", page("TPK0001", { variations: [finish("TPK0001")] })],
    ["TPK0004", page("TPK0004", { variations: [finish("TPK0004")] })],
  ]);
  const groups = groupHolleyVariants("apr", ["TPK0001", "TPK0002", "TPK0004"], pages);
  assert.deepEqual(
    groups.map((group) => group.primarySku),
    ["TPK0001", "TPK0002", "TPK0004"]
  );
  assert.ok(groups.every((group) => group.optionNames.length === 0));
});

test("one page per version without a selector groups by the short text", () => {
  const kit = (sku: string, short: string) =>
    page(sku, {
      name: "Dinan by Brembo Front Brake Set - 2008-2015 BMW 5-Series Gran Turismo/7-Series",
      short,
    });
  const pages = new Map([
    ["D290-0011-B", kit("D290-0011-B", "Front - Black Calipers - Slotted - F01/F02/F07")],
    ["D290-0011-BD", kit("D290-0011-BD", "Front - Black Calipers - Drilled - F01/F02/F07")],
    ["D290-0011-R", kit("D290-0011-R", "Front - Red Calipers - Slotted - F01/F02/F07")],
    ["D290-0011-RD", kit("D290-0011-RD", "Front - Red Calipers - Drilled - F01/F02/F07")],
    ["D290-0013-B", kit("D290-0013-B", "Rear - Black Calipers - Slotted - F01/F02")],
  ]);
  const groups = groupHolleyVariants(
    "dinan",
    ["D290-0011-B", "D290-0011-BD", "D290-0011-R", "D290-0011-RD", "D290-0013-B"],
    pages
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].optionNames, ["Caliper Color", "Rotor Type"]);
  assert.deepEqual(
    groups[0].members.map((member) => [member.sku, ...member.optionValues]),
    [
      ["D290-0011-B", "Black", "Slotted"],
      ["D290-0011-BD", "Black", "Drilled"],
      ["D290-0011-R", "Red", "Slotted"],
      ["D290-0011-RD", "Red", "Drilled"],
    ]
  );
  assert.equal(groups[1].primarySku, "D290-0013-B");
});

test("same-name parts that differ only in a colour word become colour variants", () => {
  const name = "APR Ignition Coil & Spark Plug Kit (2.0T EA888.3, EA888.4 4-cylinder engines)";
  const kit = (sku: string, color: string) => page(sku, { name, short: `${name} - ${color}` });
  const pads = (sku: string, fits: string) =>
    page(sku, { name: "APR Brake Pads (Set of 4) - Rear", short: fits });
  const pages = new Map([
    ["KT100025", kit("KT100025", "RED")],
    ["KT100026", kit("KT100026", "BLUE")],
    ["KT100027", kit("KT100027", "GREY")],
    ["BRK00042", pads("BRK00042", "Fits Audi A3 06-09; VW GTI 07-11")],
    ["BRK00045", pads("BRK00045", "Fits Audi S3 15-20; VW Golf R 15-19")],
  ]);
  const groups = groupHolleyVariants("apr", [...pages.keys()], pages);
  assert.deepEqual(
    groups.map((group) => [group.primarySku, group.optionNames, group.members.length]),
    [
      ["KT100025", ["Color"], 3],
      ["BRK00042", [], 1],
      ["BRK00045", [], 1],
    ]
  );
  assert.deepEqual(
    groups[0].members.map((member) => member.optionValues[0]),
    ["Red", "Blue", "Grey"]
  );
});

test("Dinan by Brembo SKU suffixes win over a wrong short text", () => {
  const kit = (
    sku: string,
    short: string,
    name = "Dinan by Brembo Front Brake Set - 2004-2010 BMW 5/6-Series"
  ) => page(sku, { name, short });
  const pages = new Map([
    [
      "D290-0611-B",
      kit(
        "D290-0611-B",
        "Front - Black Calipers - Slotted - E60",
        "Dinan by Brembo Front Brake Set -  2004-2010 BMW 5/6-Series"
      ),
    ],
    ["D290-0611-BD", kit("D290-0611-BD", "Front - Black Calipers - Drilled - E60")],
    ["D290-0611-R", kit("D290-0611-R", "Front - Red Calipers - Slotted - E60")],
    // The brand page says black / slotted; the photo shows red calipers and drilled rotors.
    ["D290-0611-RD", kit("D290-0611-RD", "Front - Black Calipers - Slotted - E60")],
  ]);
  const [group] = groupHolleyVariants("dinan", [...pages.keys()], pages);
  assert.deepEqual(group.optionNames, ["Caliper Color", "Rotor Type"]);
  assert.deepEqual(
    group.members.map((member) => [member.sku, ...member.optionValues]),
    [
      ["D290-0611-B", "Black", "Slotted"],
      ["D290-0611-BD", "Black", "Drilled"],
      ["D290-0611-R", "Red", "Slotted"],
      ["D290-0611-RD", "Red", "Drilled"],
    ]
  );
});

test("payloads are USD-priced drafts with variants, photos, videos and fitment", () => {
  const group: HolleyProductGroup = {
    id: "dinan:D660-0079-BLK",
    brand: "dinan",
    primarySku: "D660-0079-BLK",
    optionNames: ["Tip Finish"],
    variants: [
      {
        sku: "D660-0079-BLK",
        optionValues: ["Black Ceramic Coated"],
        priceList: priceItem("D660-0079-BLK", 3037.95, 2499.95, 63),
        page: page("D660-0079-BLK"),
        competitor: null,
        price: decideHolleyPriceUsd({
          retailUsd: 3037.95,
          mapUsd: 2499.95,
          weightLb: 63,
          competitorUsd: [],
        }),
      },
      {
        sku: "D660-0079",
        optionValues: ["Polished"],
        priceList: priceItem("D660-0079", 2733.95, 2249.95, 63),
        page: page("D660-0079"),
        competitor: null,
        price: decideHolleyPriceUsd({
          retailUsd: 2733.95,
          mapUsd: 2249.95,
          weightLb: 63,
          competitorUsd: [],
        }),
      },
    ],
  };
  const payload = buildHolleyProductPayload(group, copy, "2026-10-19T00:00:00Z");
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.isPublished, false);
  assert.equal(payload.priceSourceCurrency, "USD");
  assert.equal(payload.priceUsd, 3218);
  assert.equal(payload.brand, "Dinan");
  assert.equal(payload.categoryEn, "Exhaust Systems");
  assert.equal(payload.slug, "dinan-free-flow-axle-back-exhaust-2018-2023-bmw-m5-d660-0079-blk");
  assert.deepEqual(payload.options, [
    { name: "Tip Finish", position: 1, values: ["Black Ceramic Coated", "Polished"] },
  ]);
  assert.deepEqual(
    payload.variants.map((variant) => [
      variant.sku,
      variant.option1Value,
      variant.priceUsd,
      variant.isDefault,
    ]),
    [
      ["D660-0079-BLK", "Black Ceramic Coated", 3218, true],
      ["D660-0079", "Polished", 2931, false],
    ]
  );
  assert.equal(payload.weight, 28.58);
  assert.equal(payload.length, 134.6);
  assert.equal(payload.image, "https://images.dinancars.com/1120x/d660-0079-blk-1.jpg");
  assert.ok(
    payload.media.some(
      (media) => media.mediaType === "EXTERNAL_VIDEO" && media.src.endsWith("/embed/9rkto3OXJns")
    )
  );
  const fitment = parseSupplierFitmentContract(
    payload.metafields.find((field) => field.key === "supplier_fitment")?.value
  );
  assert.equal(fitment?.mode, "vehicle_specific");
  assert.ok(payload.tags.includes("F90"));
});

test("wheels sold one at a time say the price is per wheel", () => {
  const wheelPage = page("WHL00002", {
    name: "APR A01 Flow Formed Wheel",
    short: "Gunmetal Grey - 19x8.5 in. - 5x112mm - ET45 - Sold Individually",
    category: "Wheels & Accessories/Wheels",
  });
  const group: HolleyProductGroup = {
    id: "apr:WHL00002",
    brand: "apr",
    primarySku: "WHL00002",
    optionNames: [],
    variants: [
      {
        sku: "WHL00002",
        optionValues: [],
        priceList: priceItem("WHL00002", 499.95, 449.95, 30),
        page: wheelPage,
        competitor: null,
        price: decideHolleyPriceUsd({
          retailUsd: 499.95,
          mapUsd: 449.95,
          weightLb: 30,
          competitorUsd: [],
        }),
      },
    ],
  };
  const payload = buildHolleyProductPayload(group, copy, "2026-10-19T00:00:00Z");
  assert.ok(payload.shortDescUa?.endsWith("Ціна вказана за 1 диск."));
  assert.ok(payload.shortDescEn?.endsWith("Price is per wheel."));
  assert.match(payload.longDescUa ?? "", /Кількість:<\/strong> 1 диск/);
});

test("brand categories map onto the shop taxonomy", () => {
  assert.equal(holleyCategory("Brakes/Big Brake Kits").en, "Brake Systems");
  assert.equal(holleyCategory("Intake Systems/Intake Kits").en, "Intake Systems");
  assert.equal(holleyCategory("Suspension & Chassis Hardware/Sway Bars").en, "Suspension");
  assert.equal(holleyCategory("Engine Hardware/Engine Covers").en, "Engine & Forced Induction");
  assert.equal(holleyCategory(null).en, "Performance Parts");
  assert.equal(
    buildHolleySlug("apr", "APR Open Carbon Fiber Intake - B8 6 and 8-Cylinder", "CI100037"),
    "apr-open-carbon-fiber-intake-b8-6-and-8-cylinder-ci100037"
  );
  assert.equal(
    holleyImageUrl("apr", "583x/57a38556384c44992e2deaa28a1e1f699cf405cf.jpg"),
    "https://images.goapr.com/1120x/57a38556384c44992e2deaa28a1e1f699cf405cf.jpg"
  );
});
