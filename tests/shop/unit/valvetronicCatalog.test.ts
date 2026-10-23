import assert from "node:assert/strict";
import test from "node:test";

import { resolveShopShippingClass } from "../../../src/lib/shopShippingClass";
import type { SupplierCopy } from "../../../src/lib/supplierCatalogCopy";
import {
  VALVETRONIC_BRAND,
  buildValvetronicProductPayload,
  buildValvetronicSlug,
  calculateValvetronicPriceUsd,
  valvetronicProductType,
  valvetronicVariantSkus,
  valvetronicVariantsWithoutWeight,
  valvetronicWeightKg,
  type ValvetronicSourceProduct,
} from "../../../src/lib/valvetronicCatalog";

const product = (overrides: Partial<ValvetronicSourceProduct> = {}): ValvetronicSourceProduct => ({
  id: 6888558886948,
  handle: "audi-b9-s4-s5-race-valved-exhaust",
  url: "https://valvetronic.com/products/audi-b9-s4-s5-race-valved-exhaust",
  title: "Audi B9 S4 / S5 Valved Sport Exhaust System",
  vendor: "Valvetronic Designs",
  productType: "Motor Vehicle Exhaust",
  tags: ["audi", "b9"],
  optionNames: ["Configuration", "Tips"],
  bodyParagraphs: ["Full T304 Stainless Steel System with Electronic Valve Control"],
  videos: ["ssya6IqyFNs", "2Ywjf114v54"],
  images: [
    "https://cdn.shopify.com/s/files/1/0086/6998/6875/files/A7405504.jpg",
    "https://cdn.shopify.com/s/files/1/0086/6998/6875/files/A7405505.jpg",
  ],
  variants: [
    {
      id: 1,
      sku: "AUD.B9.S4.VSES.BR.BRSH",
      title: "Valved Sport Exhaust System / (4) Brushed Steel (3.5 Outlet)",
      options: ["Valved Sport Exhaust System", '(4) Brushed Steel (3.5" Outlet)'],
      priceUsd: 2499.99,
      salePriceUsd: null,
      grams: 40370,
      image: null,
    },
    {
      id: 2,
      sku: "AUD.B9.S4.VSES.BR.RC",
      title: "Valved Sport Exhaust System / (4) Carbon Fiber 1x1 (3.5 Outlet)",
      options: ["Valved Sport Exhaust System", '(4) Carbon Fiber 1x1 (3.5" Outlet)'],
      priceUsd: 2499.99,
      salePriceUsd: null,
      grams: 39009,
      image: null,
    },
  ],
  updatedAt: "2026-10-23T10:00:00-04:00",
  ...overrides,
});

const copy: SupplierCopy = {
  titleEn: "Valvetronic Designs Valved Sport Exhaust System for Audi S4 / S5 B9 (2017–2024)",
  titleUa: "Valvetronic Designs — клапанна вихлопна система для Audi S4 / S5 B9 (2017–2024)",
  shortDescEn: "Full valved T304 system.",
  shortDescUa: "Повна клапанна система з T304.",
  introEn: ["One.", "Two."],
  introUa: ["Один.", "Два."],
  keyPointsEn: ["Valves"],
  keyPointsUa: ["Клапани"],
  specsEn: [{ label: "Material", value: "T304" }],
  specsUa: [{ label: "Матеріал", value: "T304" }],
  inBoxEn: [],
  inBoxUa: [],
  fitmentEn: ["2017–2024 Audi S4 (B9)"],
  fitmentUa: ["2017–2024 Audi S4 (B9)"],
  importantEn: [],
  importantUa: [],
  seoTitleEn: "Valvetronic Exhaust Audi S4 S5 B9",
  seoTitleUa: "Valvetronic вихлоп Audi S4 S5 B9",
  seoDescriptionEn: "Valved exhaust.",
  seoDescriptionUa: "Клапанний вихлоп.",
  imageAltEn: "Valvetronic Designs exhaust for Audi S4 B9",
  imageAltUa: "Вихлоп Valvetronic Designs для Audi S4 B9",
  vehicles: [
    {
      make: "Audi",
      model: "S4",
      chassisCode: "B9",
      engine: null,
      yearFrom: 2017,
      yearTo: 2024,
      market: null,
      note: null,
    },
  ],
};

test("price is the regular price × 1.15 plus $12 per kg, rounded up to a dollar", () => {
  // 2499.99 × 1.15 = 2874.99; 40.37 kg × 12 = 484.44 → 3359.43 → 3360
  assert.equal(calculateValvetronicPriceUsd(2499.99, 40.37), 3360);
  // Exact grams decide the dollar: 8165 g, not 8.17 kg.
  assert.equal(calculateValvetronicPriceUsd(399.99, 8.165), 558);
  assert.throws(() => calculateValvetronicPriceUsd(2499.99, 0));
  assert.throws(() => calculateValvetronicPriceUsd(0, 10));
});

test("a sale on valvetronic.com does not lower our price: the regular price is the base", () => {
  const downpipe = product({
    variants: [
      {
        id: 3,
        sku: "BMW.G8X.M2.M3.M4.FF.400C.BR",
        title: "Default Title",
        options: [],
        priceUsd: 2249.99,
        salePriceUsd: 1912.49,
        grams: 9979,
        image: null,
      },
    ],
    optionNames: [],
  });
  const payload = buildValvetronicProductPayload(downpipe, copy, "2026-10-23T00:00:00.000Z");
  assert.equal(payload.priceUsd, 2708);
  assert.equal(payload.variants[0].priceUsd, 2708);
});

test("weights from weights.json fill the gaps of the feed", () => {
  const noWeight = { sku: "VTD.TIP.25", grams: 0 };
  assert.equal(valvetronicWeightKg(noWeight), null);
  assert.equal(valvetronicWeightKg(noWeight, { "VTD.TIP.25": 1.2 }), 1.2);
  const tips = product({
    variants: [{ ...product().variants[0], sku: "VTD.TIP.25", grams: 0 }],
  });
  assert.deepEqual(valvetronicVariantsWithoutWeight(tips), ["VTD.TIP.25"]);
  assert.deepEqual(valvetronicVariantsWithoutWeight(tips, { "VTD.TIP.25": 1.2 }), []);
});

test("variant SKUs keep the brand's SKU unless it is missing or repeated in the product", () => {
  const base = product().variants[0];
  const skus = valvetronicVariantSkus({
    variants: [
      { ...base, id: 11, sku: "AUD.R8.V10.GEN2.VSES.TI" },
      { ...base, id: 12, sku: "AUD.R8.V10.GEN2.VSES.TI" },
      { ...base, id: 13, sku: null },
      { ...base, id: 14, sku: "AUD.R8.V8.GEN1.VSES.TI" },
    ],
  });
  assert.deepEqual(skus, ["VTD-11", "VTD-12", "VTD-13", "AUD.R8.V8.GEN1.VSES.TI"]);
});

test("payload is a USD draft with brand SKUs, YouTube videos and the vehicle fitment", () => {
  const payload = buildValvetronicProductPayload(product(), copy, "2026-10-23T00:00:00.000Z");
  assert.equal(payload.brand, VALVETRONIC_BRAND);
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.isPublished, false);
  assert.equal(payload.stock, "preOrder");
  assert.equal(payload.priceSourceCurrency, "USD");
  assert.equal(payload.sku, "VTD-6888558886948");
  assert.equal(payload.slug, "valvetronic-designs-audi-b9-s4-s5-valved-sport-exhaust-system-86948");
  assert.deepEqual(
    payload.variants.map((variant) => [variant.sku, variant.priceUsd]),
    [
      ["AUD.B9.S4.VSES.BR.BRSH", 3360],
      ["AUD.B9.S4.VSES.BR.RC", 3344],
    ]
  );
  const videos = (payload.media ?? []).filter((item) => item.mediaType === "EXTERNAL_VIDEO");
  assert.deepEqual(
    videos.map((item) => [item.src, item.position]),
    [
      ["https://www.youtube.com/embed/ssya6IqyFNs", 3],
      ["https://www.youtube.com/embed/2Ywjf114v54", 4],
    ]
  );
  assert.equal(payload.categoryUa, "Вихлопні системи");
  assert.ok(payload.tags?.includes("S4"));
  const fitment = JSON.parse(
    payload.metafields?.find((item) => item.key === "supplier_fitment")?.value ?? "{}"
  );
  assert.equal(fitment.mode, "vehicle_specific");
});

test('placeholder models such as "All Models" never become vehicle applications', () => {
  const payload = buildValvetronicProductPayload(
    product({ title: "Ferrari Vacuum Exhaust Valve/Flap Controller" }),
    {
      ...copy,
      vehicles: [{ ...copy.vehicles[0], make: "Ferrari", model: "All Models", chassisCode: null }],
    },
    "2026-10-23T00:00:00.000Z"
  );
  const fitment = JSON.parse(
    payload.metafields?.find((item) => item.key === "supplier_fitment")?.value ?? "{}"
  );
  assert.equal(fitment.mode, "needs_review");
  assert.ok(!payload.tags?.includes("All Models"));
});

test("product types keep small parts out of the whole-exhaust delivery class", () => {
  const classOf = (title: string) => {
    const productType = valvetronicProductType({ title });
    return [
      productType,
      resolveShopShippingClass({
        productType,
        category: { ua: "Вихлопні системи", en: "Exhaust Systems" },
        title: { ua: title, en: title },
      }),
    ];
  };
  assert.deepEqual(classOf("Audi B9 S4 / S5 Valved Sport Exhaust System"), [
    "Exhaust Systems",
    "large",
  ]);
  assert.deepEqual(classOf("Audi C8 RS6 / RS7 400 Cell Catted Downpipes"), ["Downpipes", "large"]);
  assert.deepEqual(classOf("Valvetronic Designs Exhaust Tips (SINGLES)"), [
    "Exhaust Tips",
    "medium",
  ]);
  assert.deepEqual(classOf("Replacement Exhaust Valve Remote"), ["Exhaust Accessories", "medium"]);
  assert.deepEqual(
    classOf("Ferrari F430 / F430 Scuderia F1 Race Exhaust Headers")[0],
    "Exhaust Headers"
  );
});

test("slug drops the brand name and trademark signs", () => {
  assert.equal(
    buildValvetronicSlug({
      id: 7000000012345,
      title: "Valvetronic Designs SHUTO™ Valved Catback Exhaust for Lexus RC F",
    }),
    "valvetronic-designs-shuto-valved-catback-exhaust-for-lexus-rc-f-12345"
  );
});
