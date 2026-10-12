import assert from "node:assert/strict";
import test from "node:test";

import type { ShopProduct } from "../../../src/lib/shopCatalog";
import { extractProductFitment } from "../../../src/lib/crossShopFitment";

function product(input: {
  ua: string;
  en?: string;
  brand: string;
  vendor?: string;
  tags?: string[];
}): ShopProduct {
  return {
    slug: "title-model-product",
    sku: "TITLE-1",
    scope: "auto",
    brand: input.brand,
    vendor: input.vendor,
    title: { ua: input.ua, en: input.en ?? input.ua },
    category: { ua: "", en: "" },
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    leadTime: { ua: "", en: "" },
    stock: "inStock",
    collection: { ua: "", en: "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: [],
    tags: input.tags ?? [],
  };
}

test("a part name filed as the model never hides the vehicle the Urban title names", () => {
  const fitment = extractProductFitment(
    product({
      ua: "Комплект розширених арок Urban для Defender 110 - Gloss Black",
      en: "Urban extended arch set for Defender 110 - Gloss Black",
      brand: "Land Rover",
      vendor: "Urban Automotive",
      tags: [
        "urban-source:gp-portal",
        "fits-make:land-rover",
        "fits-model:land-rover:urban-extended-arch",
      ],
    })
  );
  assert.equal(fitment.make, "Land Rover");
  assert.deepEqual(fitment.models, ["Defender"]);
});

test("a supplier model tag the patterns do not know is still trusted", () => {
  const fitment = extractProductFitment(
    product({
      ua: "RaceChip GTS 5 — Peugeot Bipper (2008+) 1.3 HDI 75 1248cc",
      brand: "RaceChip",
      tags: ["fits-make:peugeot", "fits-model:peugeot:bipper"],
    })
  );
  assert.deepEqual(fitment.models, ["Bipper"]);
});

test("a Brabus part for another carmaker's car belongs to that car", () => {
  const bentley = extractProductFitment(
    product({ ua: "Задній дифузор Carbon на базі Bentley Continental GTC Speed", brand: "Brabus" })
  );
  assert.equal(bentley.make, "Bentley");
  assert.ok(bentley.models.some((model) => /continental/i.test(model)));

  const urus = extractProductFitment(
    product({ ua: "Передній бампер Carbon на базі Lamborghini URUS SE", brand: "Brabus" })
  );
  assert.equal(urus.make, "Lamborghini");
  assert.deepEqual(urus.models, ["Urus"]);

  const rangeRover = extractProductFitment(
    product({ ua: "Задній спойлер Carbon на базі Range Rover", brand: "Brabus" })
  );
  assert.equal(rangeRover.make, "Land Rover");
  assert.deepEqual(rangeRover.models, ["Range Rover"]);

  const own = extractProductFitment(
    product({ ua: "Диск Monoblock для Mercedes G63", brand: "Brabus" })
  );
  assert.match(own.make ?? "", /Mercedes/);
});

test("Mazda and Audi R8 models are read from the title", () => {
  const mx5 = extractProductFitment(
    product({ ua: "OHLINS Верхня опора амортизатора MAZDA MX5 NA / NB 1989-2005", brand: "OHLINS" })
  );
  assert.equal(mx5.make, "Mazda");
  assert.deepEqual(mx5.models, ["MX-5"]);
  const miata = extractProductFitment(
    product({ ua: "OHLINS Амортизатор для MAZDA MX5 Miata ND 2016 -", brand: "OHLINS" })
  );
  assert.deepEqual(miata.models, ["MX-5"]);
  const rx8 = extractProductFitment(
    product({ ua: "OHLINS Амортизатор для MAZDA RX8 SE3P 2003 -, передній", brand: "OHLINS" })
  );
  assert.deepEqual(rx8.models, ["RX-8"]);
  const r8 = extractProductFitment(
    product({ ua: "OHLINS Комплект для AUDI R8 (4S) 2015-", brand: "OHLINS" })
  );
  assert.equal(r8.make, "Audi");
  assert.deepEqual(r8.models, ["R8"]);
});
