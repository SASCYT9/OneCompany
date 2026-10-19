import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinkEcuDescriptionHtml,
  buildLinkEcuProductPayload,
  buildLinkEcuSlug,
  buildLinkEcuSupplierFitment,
  calculateLinkEcuPriceEur,
  type LinkEcuCopy,
  type LinkEcuSourceProduct,
} from "../../../src/lib/linkEcuCatalog";
import { parseSupplierFitmentContract } from "../../../src/lib/shopImportFitment";

const copy: LinkEcuCopy = {
  titleEn: "Link WRX9X Plug-In ECU for Subaru WRX / STI V7–V9 (GD/GG)",
  titleUa: "Link WRX9X — Plug-In ECU для Subaru WRX / STI V7–V9 (GD/GG)",
  shortDescEn: "Plug-In ECU for the WRX V7–V9.",
  shortDescUa: "Plug-In ECU для WRX V7–V9.",
  introEn: ["First <paragraph>.", "Second paragraph."],
  introUa: ["Перший абзац.", "Другий абзац."],
  keyPointsEn: ["Fits the factory location"],
  keyPointsUa: ["Встановлюється на штатне місце"],
  specsEn: [{ label: "Communications:", value: "2 CAN Bus Channels" }],
  specsUa: [{ label: "Зв'язок", value: "2 канали CAN" }],
  inBoxEn: ["WRX9X ECU"],
  inBoxUa: ["Блок WRX9X"],
  fitmentEn: ["Subaru WRX Version 7, GD/GG, EJ20, 2000–2002"],
  fitmentUa: ["Subaru WRX Version 7, GD/GG, EJ20, 2000–2002"],
  importantEn: ["Manual transmissions only."],
  importantUa: ["Лише для механічної КПП."],
  seoTitleEn: "Link WRX9X Plug-In ECU",
  seoTitleUa: "Link WRX9X — Plug-In ECU",
  seoDescriptionEn: "Link WRX9X Plug-In ECU for Subaru WRX V7–V9.",
  seoDescriptionUa: "Link WRX9X Plug-In ECU для Subaru WRX V7–V9.",
  imageAltEn: "Link WRX9X Plug-In ECU",
  imageAltUa: "Link WRX9X Plug-In ECU",
  vehicles: [
    {
      make: "Subaru",
      model: "Impreza WRX",
      chassisCode: "GD/GG",
      engine: "EJ20",
      yearFrom: 2000,
      yearTo: 2002,
      market: null,
      note: "Version 7",
    },
  ],
};

const plugIn: LinkEcuSourceProduct = {
  sku: "229-4000",
  handle: "wrxlink-7-9-wrx9x",
  url: "https://linkecu.com/products/wrxlink-7-9-wrx9x",
  titleSource: "WRX9X Plug-In ECU (Subaru WRX & STI V7-9)",
  productType: "Plug-In ECU",
  kind: "plug-in",
  rrpEur: 1615,
  grams: 744,
  images: ["https://cdn.shopify.com/a.jpg", "https://cdn.shopify.com/b.jpg"],
  bodyParagraphs: [],
  sections: [],
  updatedAt: "2026-09-01T00:00:00+12:00",
};

test("Link ECU price is the EU RRP × 1.20 rounded up to a whole euro", () => {
  assert.equal(calculateLinkEcuPriceEur(1795), 2154);
  assert.equal(calculateLinkEcuPriceEur(2099), 2519);
  assert.equal(calculateLinkEcuPriceEur(925), 1110);
  assert.equal(calculateLinkEcuPriceEur(695), 834);
  assert.throws(() => calculateLinkEcuPriceEur(0));
});

test("Link ECU slugs keep the model name and the part number", () => {
  assert.equal(buildLinkEcuSlug(plugIn), "link-ecu-wrx9x-plug-in-ecu-229-4000");
  assert.equal(
    buildLinkEcuSlug({
      sku: "109-9025B",
      titleSource:
        "Gen4 LS Drive-By-Wire & Fuse Box Bundle: G4X XtremeX ECU + LS Engine Harness bundle",
    }),
    "link-ecu-gen4-ls-drive-by-wire-and-fuse-box-g4x-xtremex-ecu-ls-109-9025b"
  );
});

test("Link ECU descriptions use the house layout and escape text", () => {
  const html = buildLinkEcuDescriptionHtml(copy, "en");
  assert.ok(html.startsWith("<p>First &lt;paragraph&gt;.</p><p>Second paragraph.</p>"));
  assert.ok(html.indexOf("Key features") < html.indexOf("Vehicle fitment"));
  assert.ok(html.indexOf("Vehicle fitment") < html.indexOf("Before you order"));
  assert.ok(
    html.includes("<li><span><strong>Communications:</strong> 2 CAN Bus Channels</span></li>")
  );
  const ua = buildLinkEcuDescriptionHtml(copy, "ua");
  assert.ok(ua.includes("<p><strong>Важливо перед замовленням</strong></p>"));
  assert.ok(ua.includes("<li><span><strong>Зв'язок:</strong> 2 канали CAN</span></li>"));
});

test("Plug-In ECUs carry Link's vehicle list; Wire-In ECUs stay universal", () => {
  const plugInFitment = parseSupplierFitmentContract(
    JSON.stringify(buildLinkEcuSupplierFitment(plugIn, copy.vehicles))
  );
  assert.ok(plugInFitment);
  assert.equal(plugInFitment?.mode, "vehicle_specific");

  const wireIn = buildLinkEcuSupplierFitment({ ...plugIn, kind: "wire-in" }, copy.vehicles);
  assert.equal(wireIn.mode, "universal");
  assert.equal(wireIn.version === 1 ? wireIn.applications.length : -1, 0);
  assert.ok(parseSupplierFitmentContract(JSON.stringify(wireIn)));
});

test("Link ECU payloads are EUR-priced drafts with provenance", () => {
  const payload = buildLinkEcuProductPayload(plugIn, copy, "2026-10-19T00:00:00Z");
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.isPublished, false);
  assert.equal(payload.priceSourceCurrency, "EUR");
  assert.equal(payload.priceEur, 1938);
  assert.equal(payload.variants[0].priceEur, 1938);
  assert.equal(payload.stock, "preOrder");
  assert.equal(payload.weight, 0.744);
  assert.equal(payload.media.length, 2);
  assert.ok(payload.tags.includes("Plug-In ECU"));
  assert.ok(payload.tags.includes("Subaru"));
  assert.ok(
    payload.metafields.some((field) => field.key === "rrp_eur" && field.value === "1615.00")
  );
});
