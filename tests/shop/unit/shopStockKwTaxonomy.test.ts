import assert from "node:assert/strict";
import test from "node:test";

import { getShopStockCategoryGroupForProduct } from "../../../src/lib/shopStockTaxonomy";

test("KW coilovers for a Shooting Brake remain suspension products", () => {
  const group = getShopStockCategoryGroupForProduct({
    product: {
      brand: "KW Suspensions",
      vendor: "KW Suspensions",
      productType: "Койловерна підвіска",
      title: {
        ua: "Койловерна підвіска V3 — MERCEDES-BENZ CLA Shooting Brake",
        en: "V3 coilover suspension — MERCEDES-BENZ CLA Shooting Brake",
      },
    },
  }, "ua");

  assert.equal(group.id, "suspension");
});

test("legacy KW vendor identity remains suspension", () => {
  const group = getShopStockCategoryGroupForProduct({
    product: {
      vendor: "KW Automotive Ukraine",
      title: { ua: "Комплект регулювання висоти" },
    },
  }, "ua");

  assert.equal(group.id, "suspension");
});
