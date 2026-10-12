import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { areChassisCompatible, extractProductFitment } from "../../../src/lib/crossShopFitment";
import { shopFitmentMatchesVehicleConstraints } from "../../../src/lib/shopVehicleConstraints";

function product(title: string, brand = "Test", tags: string[] = []): ShopProduct {
  return {
    slug: "platform-product",
    sku: "PLATFORM-1",
    scope: "auto",
    brand,
    title: { ua: title, en: title },
    category: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: [],
    tags,
  };
}

test("a BMW platform label (G8X) is filed on every chassis of that platform", () => {
  const fitment = extractProductFitment(product("Комплект решіток для BMW M3 / M4 G8X"));
  assert.equal(fitment.make, "BMW");
  for (const chassis of ["G80", "G81", "G82", "G83"]) {
    assert.ok(fitment.chassisCodes.includes(chassis), chassis);
  }
  assert.ok(
    shopFitmentMatchesVehicleConstraints(fitment, { make: "BMW", model: "M3", chassis: "G80" })
  );
});

test("a platform label with no model still reaches the models of that platform", () => {
  const fitment = extractProductFitment(product("Фільтр для S58 G8x Intake для BMW"));
  assert.equal(fitment.make, "BMW");
  assert.deepEqual([...fitment.models].sort(), ["M2", "M3", "M4"]);
  assert.ok(
    shopFitmentMatchesVehicleConstraints(fitment, { make: "BMW", model: "M4", chassis: "G82" })
  );
});

test("G2x covers the 3 and 4 Series generations, not the Z4", () => {
  const fitment = extractProductFitment(product("Fi EXHAUST Valvetronic для BMW 430i G2x"));
  assert.equal(fitment.make, "BMW");
  for (const chassis of ["G22", "G23", "G26"]) {
    assert.ok(fitment.chassisCodes.includes(chassis), chassis);
  }
  assert.ok(!fitment.chassisCodes.includes("G29"));
  assert.ok(!fitment.chassisCodes.includes("G20"), "a 430i is not a 3 Series");
});

test("a platform label means nothing for another make", () => {
  const fitment = extractProductFitment(product("Exhaust for Audi A4 G2X"));
  assert.equal(fitment.make, "Audi");
  assert.ok(!fitment.chassisCodes.some((code) => /^G2\d$/.test(code)));
});

test("a bare number in the title is a spec, not a model badge", () => {
  const fitment = extractProductFitment(product("BMW G2X 400 Cell Downpipe", "Test"));
  assert.deepEqual([...fitment.models].sort(), ["3 Series", "4 Series"]);
  const narrowed = extractProductFitment(product("BMW 430i G2X 300 CPSI Downpipe", "Test"));
  assert.deepEqual(narrowed.models, ["4 Series"]);
});

test("every member of a platform is filed, even the ones the code table lacked", () => {
  assert.ok(extractProductFitment(product("BMW 5 Series F1X Intake")).chassisCodes.includes("F11"));
  assert.ok(extractProductFitment(product("BMW 5 Series E6X Intake")).chassisCodes.includes("E61"));
  assert.ok(extractProductFitment(product("BMW 1 Series E8X Intake")).chassisCodes.includes("E81"));
});

test("a platform written as the supplier's model tag is a chassis list, not a model", () => {
  const fitment = extractProductFitment(
    product("Downpipe", "Test", ["fits-make:bmw", "fits-model:bmw:g2x"])
  );
  assert.ok(!fitment.models.some((model) => /g2x/i.test(model)));
  assert.ok(fitment.models.includes("3 Series") || fitment.models.includes("4 Series"));
});

test("a platform label and one of its members confirm each other", () => {
  assert.ok(areChassisCompatible("G2X", "G20"));
  assert.ok(areChassisCompatible("g22", "G2X"));
  assert.ok(areChassisCompatible("E9X", "E92"));
  assert.ok(!areChassisCompatible("G2X", "G80"));
  assert.ok(!areChassisCompatible("G2X", "G8X"));
});

test("a platform label never widens a title that names the model", () => {
  const fourSeries = extractProductFitment(product("BMW 4 Series G2X Downpipe"));
  assert.deepEqual(fourSeries.models, ["4 Series"]);
  assert.ok(fourSeries.chassisCodes.includes("G22"));
  assert.ok(!fourSeries.chassisCodes.includes("G20"));

  const m3 = extractProductFitment(product("BMW M3 G8X Downpipe"));
  assert.deepEqual(m3.models, ["M3"]);
  assert.ok(m3.chassisCodes.includes("G80"));
  assert.ok(!m3.chassisCodes.includes("G87"));

  // A chassis the title names itself is always kept.
  const explicit = extractProductFitment(product("BMW M3 G8X G87 Downpipe"));
  assert.ok(explicit.chassisCodes.includes("G87"));
});

test("a narrowed platform no longer vouches for the members the title does not mean", () => {
  const m3 = extractProductFitment(product("BMW M3 G8X Downpipe"));
  assert.ok(!m3.chassisCodes.includes("G8X"));
  assert.ok(!m3.chassisCodes.includes("G87"));
  // An unnarrowed platform keeps its label.
  const wide = extractProductFitment(product("Intake для BMW G8X"));
  assert.ok(wide.chassisCodes.includes("G87"));
});

test("an M5 platform title keeps the Touring chassis", () => {
  const m5 = extractProductFitment(product("BMW M5 E6X Intake"));
  assert.ok(m5.chassisCodes.includes("E60") && m5.chassisCodes.includes("E61"));
});
