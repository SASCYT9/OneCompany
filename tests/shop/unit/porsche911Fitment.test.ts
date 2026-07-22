import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProductFitment,
  extractPorsche911FamilyModels,
  porsche911SubmodelsCompatible,
} from "../../../src/lib/crossShopFitment";

test("Porsche 911 family extraction keeps Carrera and Turbo separate", () => {
  assert.deepEqual(
    extractPorsche911FamilyModels("Porsche 911 Carrera S / 4S / GTS (992.2) exhaust"),
    ["911 Carrera"]
  );
  assert.deepEqual(extractPorsche911FamilyModels("Porsche 911 Turbo / Turbo S (992) intercooler"), [
    "911 Turbo",
  ]);
});

test("Porsche 911 family extraction preserves GT variants", () => {
  assert.deepEqual(extractPorsche911FamilyModels("Porsche 911 GT3 RS (991.2)"), ["911 GT3 RS"]);
  assert.deepEqual(extractPorsche911FamilyModels("Porsche 911 GT2 RS (991)"), ["911 GT2 RS"]);
  assert.deepEqual(extractPorsche911FamilyModels("Porsche 911 Targa 4 GTS (992)"), ["911 Targa"]);
});

test("explicit Porsche 911 product families are mutually incompatible", () => {
  assert.equal(porsche911SubmodelsCompatible("911 Carrera", "911 Turbo"), false);
  assert.equal(porsche911SubmodelsCompatible("911 Turbo", "911 GT3"), false);
  assert.equal(porsche911SubmodelsCompatible("911 GT2 RS", "911 GT3 RS"), false);
  assert.equal(porsche911SubmodelsCompatible("911 Targa", "911 Carrera"), false);
  assert.equal(porsche911SubmodelsCompatible("911 Carrera", "911 Carrera S"), true);
  assert.equal(porsche911SubmodelsCompatible("911", "911 Turbo"), true);
});

test("product fitment normalization does not collapse Porsche 911 families", () => {
  const buildProduct = (title: string) =>
    ({
      brand: "do88",
      vendor: "do88",
      title: { en: title, ua: title },
      slug: title.toLowerCase().replace(/\s+/g, "-"),
      sku: title,
      scope: "auto",
      category: { ua: "", en: "" },
      shortDescription: { ua: "", en: "" },
      longDescription: { ua: "", en: "" },
      leadTime: { ua: "", en: "" },
      stock: "inStock",
      collection: { ua: "", en: "" },
      price: { eur: 0, usd: 0, uah: 0 },
      image: "",
      tags: ["Porsche"],
      variants: [],
      highlights: [],
      collections: [],
    }) as Parameters<typeof extractProductFitment>[0];

  const carrera = extractProductFitment(
    buildProduct("Porsche 911 Carrera S exhaust system (992.2)")
  );
  const turbo = extractProductFitment(buildProduct("Porsche 911 Turbo S intercooler kit (992.2)"));

  assert.deepEqual(carrera.models, ["911 Carrera"]);
  assert.deepEqual(turbo.models, ["911 Turbo"]);
  assert.deepEqual(carrera.chassisCodes, ["992.2"]);
  assert.deepEqual(turbo.chassisCodes, ["992.2"]);
});

test("Porsche generation tags do not become model options", () => {
  const product = {
    brand: "do88",
    vendor: "do88",
    title: {
      en: "Porsche 911 Turbo intercooler (991.2)",
      ua: "Porsche 911 Turbo intercooler (991.2)",
    },
    slug: "porsche-911-turbo-991-2",
    sku: "POR-9912-T",
    scope: "auto",
    category: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    tags: ["Porsche", "model:Porsche:991-2"],
    variants: [],
    highlights: [],
    collections: [],
  } as Parameters<typeof extractProductFitment>[0];

  const fitment = extractProductFitment(product);
  assert.deepEqual(fitment.models, ["911 Turbo"]);
  assert.equal(fitment.models.includes("991 2"), false);
});

test("Porsche product title overrides broad collection family metadata", () => {
  const product = {
    brand: "do88",
    vendor: "do88",
    title: { en: "Big Pack Porsche 911 Turbo (997.1)", ua: "Big Pack Porsche 911 Turbo (997.1)" },
    slug: "big-pack-porsche-911-turbo-997-1",
    sku: "BIG-140SIr",
    scope: "auto",
    category: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "Porsche 911 Turbo / GT2", en: "Porsche 911 Turbo / GT2" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    tags: ["Porsche", "911 Turbo", "911 GT2"],
    variants: [],
    highlights: [],
    collections: [],
  } as Parameters<typeof extractProductFitment>[0];

  assert.deepEqual(extractProductFitment(product).models, ["911 Turbo"]);
});
