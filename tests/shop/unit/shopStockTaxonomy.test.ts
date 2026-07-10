import test from "node:test";
import assert from "node:assert/strict";

import { getShopStockCategoryGroupForProduct } from "../../../src/lib/shopStockTaxonomy";

function taxonomyItem({
  brand,
  sku,
  title,
  category = "",
}: {
  brand: string;
  sku: string;
  title: string;
  category?: string;
}) {
  return {
    product: {
      brand,
      sku,
      title: { ua: title, en: title },
      category: { ua: category, en: category },
    },
  };
}

test("classifies tuning modules and ECU maps as chip tuning", () => {
  const products = [
    taxonomyItem({
      brand: "Burger Motorsports",
      sku: "BURGER-1198201603",
      title: "BMS M5/M6 Stage 1 Performance Tuner",
    }),
    taxonomyItem({
      brand: "Brabus",
      sku: "BC40-900",
      title: "PowerXtra BC40 - 900",
    }),
  ];

  assert.deepEqual(
    products.map((item) => getShopStockCategoryGroupForProduct(item, "ua").id),
    ["chipTuning", "chipTuning"]
  );
});

test("classifies Burger engine and suspension hardware", () => {
  const oilCatchCan = taxonomyItem({
    brand: "Burger Motorsports",
    sku: "BURGER-OCC",
    title: "BMS Oil Catch Can for BMW",
  });
  const strutBraces = taxonomyItem({
    brand: "Burger Motorsports",
    sku: "BURGER-BRACE",
    title: "BMS Billet Strut Braces for BMW",
  });

  assert.equal(getShopStockCategoryGroupForProduct(oilCatchCan, "ua").id, "performance");
  assert.equal(getShopStockCategoryGroupForProduct(strutBraces, "ua").id, "suspension");
});

test("classifies Urban exterior SKU families without relying on translated titles", () => {
  const bodyKit = taxonomyItem({
    brand: "Urban Automotive",
    sku: "URB-BOD-25353141-V1",
    title: "Discovery 5 styling package",
  });
  const sideSteps = taxonomyItem({
    brand: "Urban Automotive",
    sku: "URB-SID-25353119-V1",
    title: "Defender side equipment",
  });

  assert.equal(getShopStockCategoryGroupForProduct(bodyKit, "ua").id, "carbonAero");
  assert.equal(getShopStockCategoryGroupForProduct(sideSteps, "ua").id, "accessories");
});

test("classifies Brabus Widestar and SportXtra product lines", () => {
  const widestar = taxonomyItem({
    brand: "Brabus",
    sku: "465-234-00",
    title: "BRABUS WIDESTAR for Mercedes-AMG G 63",
  });
  const sportXtra = taxonomyItem({
    brand: "Brabus",
    sku: "RRC-108-00",
    title: "SportXtra BRABUS for Rolls-Royce Cullinan",
  });

  assert.equal(getShopStockCategoryGroupForProduct(widestar, "ua").id, "carbonAero");
  assert.equal(getShopStockCategoryGroupForProduct(sportXtra, "ua").id, "suspension");
});

test("classifies Brabus catalog-specific translated accessories", () => {
  const rearInsert = taxonomyItem({
    brand: "Brabus",
    sku: "448-400-00S",
    title: "Спортивний Signature Heckeinsatz для Mercedes",
  });
  const illuminatedStep = taxonomyItem({
    brand: "Brabus",
    sku: "9TY-816-20",
    title: "Підсвічена підніжка BRABUS",
  });

  assert.equal(getShopStockCategoryGroupForProduct(rearInsert, "ua").id, "carbonAero");
  assert.equal(getShopStockCategoryGroupForProduct(illuminatedStep, "ua").id, "accessories");
});

test("classifies Akrapovic exterior aero separately from exhaust systems", () => {
  const diffuser = taxonomyItem({
    brand: "AKRAPOVIC",
    sku: "DI-BM/CA/1",
    title: "Rear diffuser carbon for BMW M3 F80",
  });
  const exhaust = taxonomyItem({
    brand: "AKRAPOVIC",
    sku: "M-BM/T/8H",
    title: "Slip-On Line titanium exhaust system for BMW M3 F80",
  });

  assert.equal(getShopStockCategoryGroupForProduct(diffuser, "ua").id, "carbonAero");
  assert.equal(getShopStockCategoryGroupForProduct(exhaust, "ua").id, "exhaust");
});
