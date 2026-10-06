import test from "node:test";
import assert from "node:assert/strict";
import {
  repriceShopSourceMoney,
  isShopSourcePriceBook,
  shopSaleUsdPerEur,
} from "../../../src/lib/shopPriceBookCurrency";
import { expandShopPrices } from "../../../src/lib/shopPriceConversion";
import { convertShopMoney, convertShopCurrencyAmount } from "../../../src/lib/shopMoneyFormat";
import { computeShopDisplayPrices } from "../../../src/lib/shopDisplayPrices";
import { normalizeShopCurrencyRates } from "../../../src/lib/shopAdminSettings";
import { managedAdminPriceChange } from "../../../src/lib/shopAdminPriceConversion";
import { resolveShopPriceBands } from "../../../src/lib/shopPricingAudience";
import {
  buildShopCatalogEffectivePriceContext,
  buildShopCatalogEffectivePriceSql,
} from "../../../src/lib/shopCatalogEffectivePrice.server";
import { wheelForceSetMoney } from "../../../src/lib/wheelforceFamily";
import { calculateInternationalDeliveryQuote } from "../../../src/lib/shopInternationalDeliveryQuote";

const rates = { EUR: 1, USD: 1.14, UAH: 51.5, _rawUsdToUah: 45.5, _uahReserve: 0, _manualCross: 1 };
const context = {
  customerGroup: null,
  customerB2BDiscountPercent: null,
  defaultB2BDiscountPercent: 0,
  b2bVisibilityMode: "request_quote",
  isAuthenticated: false,
  priceCountry: "Ukraine",
  currencyRates: rates,
};

test("manual requotes retain Europe-only VAT and signed regional discounts", () => {
  const sourceItems = ["europe", "default"].map((region) => ({
    slug: region,
    unitPrice: 100,
    sourceCurrency: "EUR",
    sourceAmount: 100,
    pricingBaseRegion: region,
  }));
  const snapshot = {
    currency: "EUR",
    taxableSubtotal: 90,
    regionalAdjustmentAmount: -20,
    regionalPricingRule: { mode: "percent", value: -10 },
    taxRegion: { rate: 0.2, appliesToShipping: true },
    items: sourceItems,
  };
  const items = sourceItems.map((item) => ({
    id: item.slug,
    productSlug: item.slug,
    quantity: 1,
    price: 100,
    total: 100,
  }));
  const quote = calculateInternationalDeliveryQuote(
    { currency: "EUR", pricingSnapshot: snapshot, items },
    rates,
    200
  );
  assert.equal(quote.regionalAdjustmentAmount, -1030);
  assert.equal(quote.taxableSubtotal, 4635);
  assert.equal(quote.taxableShippingCost, 100);
  assert.equal(quote.taxAmount, 947);
  assert.equal(quote.total, 10417);
});

test("manual zero reserve survives settings normalization and retains all three chosen rates", () => {
  const normalized = normalizeShopCurrencyRates(rates);
  assert.deepEqual(normalized, rates);
  assert.equal(isShopSourcePriceBook(normalized), true);
  assert.equal(shopSaleUsdPerEur(normalized), 1.14);
  assert.equal(isShopSourcePriceBook({ EUR: 1 } as never), false);
});

test("all display paths recompute stale materialized prices from EUR and USD with no reserve", () => {
  for (const [sourceCurrency, expectedUah, expectedUsd] of [
    ["EUR", 5150, 114],
    ["USD", 4550, 100],
  ] as const) {
    const source = { eur: 100, usd: 100, uah: 9999, sourceCurrency };
    assert.equal(repriceShopSourceMoney(source, rates).uah, expectedUah);
    assert.equal(expandShopPrices(source, rates).uah, expectedUah);
    assert.equal(computeShopDisplayPrices(source, rates).uah, expectedUah);
    assert.equal(convertShopMoney(source, "UAH", rates), expectedUah);
    assert.equal(convertShopMoney(source, "USD", rates), expectedUsd);
    assert.equal(
      resolveShopPriceBands({ b2cPrice: source, context }).effectivePrice.uah,
      expectedUah
    );
    assert.equal(managedAdminPriceChange(100, sourceCurrency, rates)?.uah, String(expectedUah));
  }
});

test("wheel sets preserve original unit quantity and source precision at manual rates", () => {
  const unit = { eur: 10.01, usd: 1, uah: 1, sourceCurrency: "EUR" as const };
  assert.equal(convertShopMoney(wheelForceSetMoney(unit), "UAH", rates), 2062.08);
});

test("fixed UAH prices and scalar shipping conversions use the direct chosen rates", () => {
  assert.equal(
    convertShopMoney({ eur: 1, usd: 1, uah: 4550, sourceCurrency: "UAH" }, "USD", rates),
    100
  );
  assert.equal(convertShopCurrencyAmount(100, "USD", "UAH", rates, 2), 4550);
  assert.equal(convertShopCurrencyAmount(100, "EUR", "UAH", rates, 2), 5150);
  assert.equal(convertShopCurrencyAmount(100, "EUR", "USD", rates, 2), 114);
  assert.equal(convertShopCurrencyAmount(5150, "UAH", "EUR", rates, 2), 100);
});

test("international delivery quotes keep EUR-native goods and separate shipping currencies", () => {
  for (const currency of ["EUR", "USD"]) {
    const displayedPrice = currency === "EUR" ? 100 : 114;
    const order = {
      currency,
      pricingSnapshot: {
        items: [{ slug: "euro-product", sourceCurrency: "EUR", sourceAmount: 100 }],
      },
      items: [
        {
          id: "line",
          productSlug: "euro-product",
          quantity: 1,
          price: displayedPrice,
          total: displayedPrice,
        },
      ],
    };
    assert.equal(
      calculateInternationalDeliveryQuote(order, rates, "20", undefined, "USD").total,
      6060
    );
    assert.equal(
      calculateInternationalDeliveryQuote(order, rates, "20", undefined, "EUR").total,
      6180
    );
  }
});

test("catalog SQL filters and sorting retain manual source mode and independent cross", () => {
  const sqlContext = buildShopCatalogEffectivePriceContext({
    viewer: context,
    currency: "UAH",
    currencyRates: rates,
  });
  assert.equal(sqlContext.currencyRates._uahReserve, 0);
  assert.equal(sqlContext.currencyRates._manualCross, 1);
  const sql = buildShopCatalogEffectivePriceSql(sqlContext);
  assert.ok(sql.sql.includes("source.currency"));
  assert.ok(sql.values.includes(51.5));
  assert.ok(sql.values.includes(45.5));
});
