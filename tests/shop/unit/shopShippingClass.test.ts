import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveShopShippingClass,
  SHOP_SHIPPING_CLASS_PRICE_UAH,
} from "../../../src/lib/shopShippingClass";

function item(productType: string, titleEn = "", titleUa = "", categoryEn = "") {
  return {
    productType,
    category: { en: categoryEn, ua: "" },
    title: { en: titleEn, ua: titleUa },
  };
}

test("owner-approved Nova Poshta prices per size class", () => {
  assert.deepEqual(SHOP_SHIPPING_CLASS_PRICE_UAH, {
    small: 300,
    medium: 800,
    large: 2000,
    oversize: 5000,
  });
});

test("product types map to the expected size class", () => {
  const cases: Array<[string, string]> = [
    ["Chip Tuning", "small"],
    ["JB4 Tuners", "small"],
    ["Wheel Spacers & Accessories", "small"],
    ["Brake Pads", "small"],
    ["Повітряні фільтри", "small"],
    ["Верхня опора підвіски", "small"],
    ["Опори амортизаторів", "small"],
    ["Exhaust Tips", "medium"],
    ["Аксесуари вихлопної системи", "medium"],
    ["Cars / Tailpipes", "medium"],
    ["Intake Systems", "medium"],
    ["Brake Rotors", "medium"],
    ["Масляні радіатори і компоненти", "medium"],
    ["Пружини підвіски", "medium"],
    ["Вихлопна система", "large"],
    ["Cars / Bundles", "large"],
    ["Койловерна підвіска", "large"],
    ["Радіатори та аксесуари", "large"],
    ["Інтеркулери", "large"],
    ["Дифузори", "large"],
    ["Бампера, накладки на бампера та підспойлери", "oversize"],
    ["Комплекти обвісів", "oversize"],
    ["Hoods", "oversize"],
    ["Пороги", "oversize"],
    ["Wheel Sets", "oversize"],
  ];
  for (const [productType, expected] of cases) {
    assert.equal(resolveShopShippingClass(item(productType)), expected, productType);
  }
});

test("generic types fall back to the title, unknown items count as medium", () => {
  assert.equal(
    resolveShopShippingClass(item("Premium Tuning", "BRABUS carbon rear spoiler for G 63")),
    "oversize"
  );
  assert.equal(
    resolveShopShippingClass(item("Carbon Part", "", "Карбонові накладки на дзеркала")),
    "small"
  );
  assert.equal(
    resolveShopShippingClass(item("Performance Part", "Burger charge pipe for B58")),
    "medium"
  );
  assert.equal(resolveShopShippingClass(item("Premium Tuning", "BRABUS Monoblock Z")), "large");
  assert.equal(
    resolveShopShippingClass(item("Premium Tuning", "", "Шкіряний чохол для ключів BRABUS")),
    "small"
  );
  assert.equal(
    resolveShopShippingClass(item("Premium Tuning", "", "Світлодіодні панелі на дверях")),
    "medium"
  );
  assert.equal(
    resolveShopShippingClass(item("Performance Part", "", "Синій силіконовий патрубок 25°")),
    "small"
  );
  assert.equal(
    resolveShopShippingClass(item("Performance Part", "", "Інтеркулер do88 з патрубками")),
    "large"
  );
  // iPE files whole exhaust systems under the generic "Accessories" type.
  assert.equal(
    resolveShopShippingClass(item("Accessories", "", "Вихлопна система Audi RS4 (B9)")),
    "large"
  );
  assert.equal(resolveShopShippingClass(item("Accessories", "", "Кріплення клапана")), "small");
  assert.equal(resolveShopShippingClass(item("", "", "", "")), "medium");
});

test("a specific type wins over words in the title", () => {
  assert.equal(
    resolveShopShippingClass(
      item("Верхня опора підвіски", "", "Опора амортизатора KW для койловерів")
    ),
    "small"
  );
});

test("motorcycle parts are one class smaller", () => {
  assert.equal(resolveShopShippingClass({ ...item("Амортизатори"), scope: "moto" }), "medium");
  assert.equal(
    resolveShopShippingClass({ ...item("", "", "Переднє крило Ducati"), scope: "moto" }),
    "large"
  );
  assert.equal(resolveShopShippingClass({ ...item("Chip Tuning"), scope: "moto" }), "small");
});

test("Cyrillic whole words do not match inside other words", () => {
  // "арки" (wheel arches) is oversize, but not as part of "марки".
  assert.equal(resolveShopShippingClass(item("", "", "Розширювачі арки Urban")), "oversize");
  assert.equal(resolveShopShippingClass(item("", "", "Шильдик марки")), "medium");
});
