import test from "node:test";
import assert from "node:assert/strict";
import { classifySmallHoseProduct } from "../../../src/lib/shopHoseVisibility";

test("small clamps use the current separately approved source rates and stale mixed prices fail closed", () => {
  const currentRates = {
    EUR: 1,
    USD: 1.14,
    UAH: 51.5,
    _uahReserve: 0,
    _rawUsdToUah: 45.5,
    _manualCross: 1,
  };
  assert.equal(
    classifySmallHoseProduct({ ...hose, priceEur: 175, priceSourceCurrency: "EUR" }, currentRates)
      .hide,
    true
  );
  assert.equal(
    classifySmallHoseProduct(
      { ...hose, priceEur: 0, priceUsd: 201, priceSourceCurrency: "USD" },
      currentRates
    ).hide,
    false
  );
  assert.equal(
    classifySmallHoseProduct(
      { ...hose, priceEur: 90, priceUsd: 90, priceSourceCurrency: undefined },
      currentRates
    ).reason,
    "price_unknown_review"
  );
});

const rates = { EUR: 1, USD: 1.1, UAH: 50 };
const hose = {
  titleEn: "Silicone Hose 90°",
  titleUa: "Силіконовий шланг",
  priceEur: 100,
  priceSourceCurrency: "EUR",
  categoryEn: "Hoses & Couplers > Elbows",
};
test("hide only priced hoses/clamps up to $200 using the catalog cross rate", () => {
  assert.equal(classifySmallHoseProduct(hose, rates).hide, true);
  assert.equal(
    classifySmallHoseProduct({ ...hose, priceUsd: 200, priceSourceCurrency: "USD" }, rates).hide,
    true
  );
  assert.equal(
    classifySmallHoseProduct({ ...hose, priceUsd: 200.01, priceSourceCurrency: "USD" }, rates).hide,
    false
  );
  assert.equal(
    classifySmallHoseProduct({ ...hose, priceEur: undefined }, rates).reason,
    "price_unknown_review"
  );
});
test("a higher-priced variant or an intake kit prevents hiding the whole card", () => {
  assert.equal(
    classifySmallHoseProduct({ ...hose, variants: [{ priceUsd: 250 }] }, rates).hide,
    false
  );
  assert.equal(
    classifySmallHoseProduct(
      {
        ...hose,
        categoryEn: "Intakes",
        titleEn: "Intake kit with hoses",
        titleUa: "Комплект впуску",
      },
      rates
    ).reason,
    "mixed_product_review"
  );
  assert.equal(
    classifySmallHoseProduct(
      { ...hose, categoryEn: "Wheels", titleEn: "Wheel", titleUa: "Диск" },
      rates
    ).hide,
    false
  );
});

test("a real intercooler or radiator hose remains a hose, not the larger component it connects to", () => {
  assert.equal(
    classifySmallHoseProduct(
      {
        ...hose,
        categoryEn: "Vehicle Specific > Volvo",
        titleEn: "Volvo Intercooler Inlet Hose",
        titleUa: "Шланг інтеркулера",
      },
      rates
    ).hide,
    true
  );
  assert.equal(
    classifySmallHoseProduct(
      {
        ...hose,
        categoryEn: "Vehicle Specific > Saab",
        titleEn: "Saab Heater Core Hoses",
        titleUa: "Шланги радіатора пічки",
      },
      rates
    ).hide,
    true
  );
});
