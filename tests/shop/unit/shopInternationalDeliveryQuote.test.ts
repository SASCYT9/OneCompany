import test from "node:test";
import assert from "node:assert/strict";
import { calculateInternationalDeliveryQuote, internationalDeliveryAgreementMatches } from "../../../src/lib/shopInternationalDeliveryQuote";

const rates = { EUR: 1, USD: 1.1, UAH: 49 };
const order = { currency: "USD", pricingSnapshot: {}, items: [{ id: "i1", quantity: 3, price: 10.01, total: 30.03 }] };

test("native quote source preserves UAH across EUR/USD display choices and a repeated agreement", () => {
  const fx = { EUR: 1, USD: 50.6975 / 44.8333, UAH: 50.6975, _rawUsdToUah: 44.8333, _uahReserve: 1, _mixedSourceCurrency: 1 };
  const snapshot = { currency: "EUR", currencyRates: fx, items: [{ slug: "native-usd", variantId: "v1", unitPrice: 88.43, sourceCurrency: "USD", sourceAmount: 100, pricingBaseRegion: "default" }] };
  const quoted = { currency: "EUR", pricingSnapshot: snapshot, items: [{ id: "line", productSlug: "native-usd", variantId: "v1", quantity: 2, price: 88.43, total: 176.86 }] };
  const quote = calculateInternationalDeliveryQuote(quoted, fx, "20", undefined, "USD");
  assert.equal(quote.items[0].price, 4583.33);
  assert.equal(quote.subtotal, 9166.66);
  assert.equal(quote.shippingCost, 916.67);
  const repeated = calculateInternationalDeliveryQuote({ ...quoted, currency: "UAH", items: quote.items.map(item => ({ ...item, productSlug: "native-usd", variantId: "v1" })), pricingSnapshot: { currency: "UAH", originalPricingSnapshot: snapshot } }, fx, "20", undefined, "USD");
  assert.equal(repeated.total, quote.total);
});
test("quote converts original unit prices once and keeps bank basket integer kopecks consistent", () => {
  const quote = calculateInternationalDeliveryQuote(order, rates, "100.50", "0");
  assert.equal(quote.items[0].price, 445.9);
  assert.equal(quote.items[0].total, 1337.7);
  assert.equal(quote.total, 1438.2);
  assert.equal(quote.currency, "UAH");
  assert.equal(calculateInternationalDeliveryQuote({ ...order, currency: "UAH", items: quote.items }, rates, "100.50", "0").total, quote.total);
});

test("shipping accepts USD/EUR/UAH independently of product currency and retains original source money", () => {
  const sourceOrder = { currency: "EUR", pricingSnapshot: {}, items: [{ id: "i1", quantity: 1, price: 100, total: 100 }] };
  const fx = { EUR: 1, USD: 1.15, UAH: 53 };
  for (const [currency, shippingCost, total] of [["USD", 921.74, 6221.74], ["EUR", 1060, 6360], ["UAH", 20, 5320]] as const) {
    const quote = calculateInternationalDeliveryQuote(sourceOrder, fx, "20.00", undefined, currency);
    assert.equal(quote.shippingCost, shippingCost);
    assert.equal(quote.total, total);
    assert.equal(quote.shippingQuote.amount, 20);
    assert.equal(quote.shippingQuote.currency, currency);
    assert.equal(quote.shippingQuote.amountUah, shippingCost);
    assert.equal(sourceOrder.items[0].price, 100);
    const repeated = calculateInternationalDeliveryQuote({ ...sourceOrder, currency: "UAH", items: quote.items }, fx, quote.shippingQuote.amount, undefined, currency);
    assert.equal(repeated.total, total);
  }
});

test("foreign delivery costs cannot use an unsupported currency or missing exchange rate", () => {
  assert.throws(() => calculateInternationalDeliveryQuote(order, rates, 20, undefined, "GBP"), /UNSUPPORTED_SHIPPING_CURRENCY/);
  assert.throws(() => calculateInternationalDeliveryQuote(order, { ...rates, USD: 0 }, 20, undefined, "USD"), /EXCHANGE_RATE_UNAVAILABLE/);
  assert.throws(() => calculateInternationalDeliveryQuote(order, rates, "20.001", undefined, "EUR"), /INVALID_DELIVERY_QUOTE_COST/);
});

test("VAT applies to converted delivery money while the source USD amount remains unchanged", () => {
  const sourceOrder = { currency: "EUR", taxAmount: 20, pricingSnapshot: { taxableSubtotal: 100, taxRegion: { rate: 0.2, appliesToShipping: true } }, items: [{ id: "i1", quantity: 1, price: 100, total: 100 }] };
  const quote = calculateInternationalDeliveryQuote(sourceOrder, { EUR: 1, USD: 1.15, UAH: 53 }, 20, undefined, "USD");
  assert.equal(quote.shippingCost, 921.74);
  assert.equal(quote.taxAmount, 1244.35);
  assert.equal(quote.total, 7466.09);
  assert.equal(quote.shippingQuote.amount, 20);
});
test("payment requires agreement for the exact final currency and amount", () => {
  const snapshot = { internationalDelivery: { status: "agreed", currency: "UAH", total: 500 } };
  assert.equal(internationalDeliveryAgreementMatches(snapshot, "UAH", 500), true);
  assert.equal(internationalDeliveryAgreementMatches(snapshot, "UAH", 500.01), false);
  assert.equal(internationalDeliveryAgreementMatches(snapshot, "USD", 500), false);
  assert.equal(internationalDeliveryAgreementMatches({}, "UAH", 500), false);
});
test("invalid costs, currency and quantities cannot become a payable quote", () => {
  assert.throws(() => calculateInternationalDeliveryQuote(order, rates, -1, 0));
  assert.throws(() => calculateInternationalDeliveryQuote(order, rates, true, 0));
  assert.throws(() => calculateInternationalDeliveryQuote(order, rates, "1.234", 0));
  assert.throws(() => calculateInternationalDeliveryQuote({ ...order, currency: "GBP" }, rates, 0, 0));
  assert.throws(() => calculateInternationalDeliveryQuote({ ...order, items: [{ ...order.items[0], quantity: 1.5 }] }, rates, 0, 0));
});

test("agreed quote preserves a signed regional price adjustment", () => {
  const quote = calculateInternationalDeliveryQuote({ ...order, pricingSnapshot: { regionalAdjustmentAmount: -1.1 } }, rates, 0, 0);
  assert.equal(quote.regionalAdjustmentAmount, -49);
  assert.equal(quote.total, 1288.7);
});

test("manual shipping preserves checkout's taxable share instead of clearing VAT", () => {
  const quote = calculateInternationalDeliveryQuote({ currency: "UAH", taxAmount: 10, items: [{ id: "i1", quantity: 1, price: 100, total: 100 }], pricingSnapshot: { taxableSubtotal: 50, taxRegion: { rate: 0.2, appliesToShipping: true } } }, rates, 20);
  assert.equal(quote.taxableSubtotal, 50);
  assert.equal(quote.taxableShippingCost, 10);
  assert.equal(quote.taxAmount, 12);
  assert.equal(quote.total, 132);
});
