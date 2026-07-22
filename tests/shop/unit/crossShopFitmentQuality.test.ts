import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { extractProductFitment } from "../../../src/lib/crossShopFitment";

function product(input: Partial<ShopProduct> & Pick<ShopProduct, "title">): ShopProduct {
  return {
    slug: input.slug ?? "test-product",
    sku: input.sku ?? "TEST-1",
    scope: input.scope ?? "auto",
    brand: input.brand ?? "Test",
    title: input.title,
    category: { ua: "", en: "" },
    shortDescription: input.shortDescription ?? { ua: "", en: "" },
    longDescription: input.longDescription ?? { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: input.collection ?? { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: [],
    tags: input.tags ?? [],
    productType: input.productType,
  };
}

test("description mentions do not contaminate hard Audi fitment", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Urban",
      slug: "urban-audi-rs4-b9-splitter",
      title: { ua: "Спліттер для Audi RS4 B9", en: "Splitter for Audi RS4 B9" },
      longDescription: {
        ua: "Інші колекції бренду доступні для RS6 та RS7.",
        en: "Other brand collections are available for RS6 and RS7.",
      },
    })
  );

  assert.equal(fitment.make, "Audi");
  assert.deepEqual(fitment.models, ["RS4"]);
  assert.deepEqual(fitment.chassisCodes, ["B9"]);
});

test("legacy Toyota Supra is not normalized to GR Supra", () => {
  const fitment = extractProductFitment(
    product({
      brand: "CSF",
      title: { ua: "Радіатор Toyota Supra A80", en: "Radiator for Toyota Supra A80" },
    })
  );

  assert.equal(fitment.make, "Toyota");
  assert.deepEqual(fitment.models, ["Supra"]);
  assert.deepEqual(fitment.chassisCodes, ["A80"]);
});

test("Nissan Skyline GT-R generations remain separate from R35 GT-R", () => {
  const fitment = extractProductFitment(
    product({
      brand: "GiroDisc",
      tags: ["car_make:Nissan", "car_model:skyline-gt-r"],
      title: {
        ua: "Диски Nissan Skyline GT-R R32 / R33 / R34",
        en: "Rotors for Nissan Skyline GT-R R32 / R33 / R34",
      },
    })
  );

  assert.equal(fitment.make, "Nissan");
  assert.deepEqual(fitment.models, ["skyline gt-r"]);
  assert.deepEqual(fitment.chassisCodes, ["R32", "R33", "R34"]);
});

test("supplier vehicle tags override ambiguous model tokens in the title", () => {
  const taggedProduct = product({
    brand: "RaceChip",
    title: {
      ua: "RaceChip GTS 5 — Fiat Talento 296 (2016+) 1.6 D 1598cc",
      en: "RaceChip GTS 5 — Fiat Talento 296 (2016+) 1.6 D 1598cc",
    },
    tags: [
      "car_make:fiat",
      "car_model:talento-296-from-2016",
      "fits-make:fiat",
      "fits-model:fiat:talento",
      "fits-trim:fiat:talento:296",
    ],
  });

  const fitment = extractProductFitment(taggedProduct);
  assert.equal(fitment.make, "Fiat");
  assert.deepEqual(fitment.models, ["Talento"]);
  assert.deepEqual(fitment.yearRanges, [{ from: 2016, to: null }]);
});

test("Burger supplier model tags are treated as canonical fitment", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Burger Motorsports",
      title: { ua: "JB4 для Dodge Charger", en: "JB4 for Dodge Charger" },
      tags: ["brand:Dodge", "model:Charger"],
    })
  );

  assert.equal(fitment.make, "Dodge");
  assert.deepEqual(fitment.models, ["Charger"]);
});

test("RAM supplier tags resolve to Ram instead of Dodge", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Burger Motorsports",
      title: { ua: "JB4 для RAM 1500", en: "JB4 for RAM 1500" },
      tags: ["brand:RAM", "model:1500"],
    })
  );

  assert.equal(fitment.make, "Ram");
  assert.deepEqual(fitment.models, ["1500"]);
});

test("BMW motorcycle titles preserve the full model", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Ilmberger Carbon",
      scope: "moto",
      title: {
        ua: "Карбонова деталь для BMW M 1000 XR",
        en: "Carbon part for BMW M 1000 XR",
      },
    })
  );

  assert.equal(fitment.make, "BMW");
  assert.deepEqual(fitment.models, ["M1000XR"]);
});

test("Brabus spaced Mercedes chassis resolves the vehicle family", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Brabus",
      title: {
        ua: "Передній спойлер для Mercedes – S 206 – AMG Line",
        en: "Front spoiler for Mercedes – S 206 – AMG Line",
      },
      tags: ["fits-make:mercedes-benz"],
    })
  );

  assert.equal(fitment.make, "Mercedes-Benz");
  assert.deepEqual(fitment.chassisCodes, ["S206"]);
  assert.deepEqual(fitment.models, ["C-Class"]);
});

test("Brabus AMG trim noise falls back to the canonical chassis family", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Brabus",
      title: {
        ua: "Карбоновий спойлер для Mercedes – S 206 – AMG C 63",
        en: "Carbon spoiler for Mercedes – S 206 – AMG C 63",
      },
      tags: ["fits-make:mercedes-benz"],
    })
  );

  assert.equal(fitment.make, "Mercedes-Benz");
  assert.deepEqual(fitment.models, ["C-Class"]);
});

test("Brabus Porsche products override the incorrect generic Mercedes tag", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Brabus",
      title: {
        ua: "BRABUS на базі Porsche 911 Turbo",
        en: "BRABUS based on Porsche 911 Turbo",
      },
      tags: ["fits-make:mercedes-benz"],
    })
  );

  assert.equal(fitment.make, "Porsche");
  assert.deepEqual(fitment.models, ["911 Turbo"]);
});

test("Brabus Mercedes X-Class titles resolve spaced W 470 chassis", () => {
  const fitment = extractProductFitment(
    product({
      brand: "Brabus",
      title: {
        ua: "Деталь для Mercedes – W 470 – X 250",
        en: "Part for Mercedes – W 470 – X 250",
      },
      tags: ["fits-make:mercedes-benz"],
    })
  );

  assert.equal(fitment.make, "Mercedes-Benz");
  assert.deepEqual(fitment.chassisCodes, ["W470"]);
  assert.deepEqual(fitment.models, ["X-Class"]);
});

test("GiroDisc title models are recovered from supplier make tags", () => {
  const challenger = extractProductFitment(
    product({
      brand: "GiroDisc",
      sku: "A1-999",
      tags: ["car_make:Dodge", "brand:GiroDisc"],
      title: { ua: "Диски Dodge Challenger SRT", en: "Rotors for Dodge Challenger SRT" },
    })
  );
  const mc20 = extractProductFitment(
    product({
      brand: "GiroDisc",
      sku: "A1-998",
      tags: ["car_make:Maserati", "brand:GiroDisc"],
      title: { ua: "Диски Maserati MC20", en: "Rotors for Maserati MC20" },
    })
  );

  assert.deepEqual(challenger.models, ["Challenger"]);
  assert.deepEqual(mc20.models, ["MC20"]);
});

test("GiroDisc Lotus supplier typo normalizes to Emira", () => {
  const fitment = extractProductFitment(
    product({
      brand: "GiroDisc",
      tags: ["car_make:Lotus"],
      title: { ua: "Диски Lotus Elmira", en: "Rotors for Lotus Elmira" },
    })
  );

  assert.deepEqual(fitment.models, ["Emira"]);
});
