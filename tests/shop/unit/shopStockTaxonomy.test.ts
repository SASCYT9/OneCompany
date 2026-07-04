import test from "node:test";
import assert from "node:assert/strict";

import {
  getShopStockCategoryLabelForProduct,
  matchesShopStockCategory,
  type ShopStockTaxonomyItem,
} from "../../../src/lib/shopStockTaxonomy";

function makeItem(product: ShopStockTaxonomyItem["product"]): ShopStockTaxonomyItem {
  return { product };
}

test("maps legacy store categories into buyer-friendly stock groups", () => {
  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "RaceChip",
        title: { en: "RaceChip GTS Black for BMW M5 F90" },
        category: { ua: "Cars / Bundles", en: "Cars / Bundles" },
      }),
      "ua"
    ),
    "Чіп-тюнінг"
  );

  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "Akrapovic",
        title: { en: "Evolution Line Titanium Cat-back Exhaust" },
        category: { ua: "Ducati Panigale V4 (MY 2025)", en: "Ducati Panigale V4 (MY 2025)" },
      }),
      "ua"
    ),
    "Вихлопні системи"
  );

  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "do88",
        title: { en: "Black silicone reducer elbow hose" },
        category: { ua: "Шланги та патрубки > Чорні силіконові патрубки", en: "Hoses & Couplers" },
      }),
      "ua"
    ),
    "Охолодження та патрубки"
  );

  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "Burger Motorsports",
        title: { en: "2025+ Toyota 4Runner Wheel Spacers" },
        productType: "Wheel Spacers & Accessories",
      }),
      "en"
    ),
    "Wheels"
  );

  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "Burger Motorsports",
        title: { en: "BMW S55 Charge Pipe Injection Kit" },
        productType: "Engine Performance",
      }),
      "en"
    ),
    "Intake, turbo and engine"
  );

  assert.equal(
    getShopStockCategoryLabelForProduct(
      makeItem({
        brand: "Akrapovic",
        title: { en: "AKRAPOVIC 801607 Rubber USB flash drive 16 GB" },
        category: { ua: "Одяг та сувеніри", en: "Apparel and souvenirs" },
      }),
      "en"
    ),
    "Merch"
  );
});

test("matches curated group labels while preserving raw category fallback", () => {
  const ilmbergerItem = makeItem({
    brand: "Ilmberger Carbon",
    title: { en: "Carbon belly pan for BMW M 1000 RR" },
    category: { ua: "BMW M 1000 RR (MY 2023)", en: "BMW M 1000 RR (MY 2023)" },
  });

  assert.equal(matchesShopStockCategory(ilmbergerItem, "Мото карбон", "ua"), true);
  assert.equal(matchesShopStockCategory(ilmbergerItem, "BMW M 1000 RR (MY 2023)", "ua"), true);
  assert.equal(matchesShopStockCategory(ilmbergerItem, "Гальмівна система", "ua"), false);
});
