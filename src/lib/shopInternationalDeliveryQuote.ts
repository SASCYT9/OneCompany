import {
  convertShopCurrencyAmount,
  type ShopCurrencyCode,
  type ShopCurrencyRates,
} from "@/lib/shopMoneyFormat";
import { monobankMinorUnits } from "@/lib/shopMonobank";
import { calculateTaxAmount, calculateProportionalAmount } from "@/lib/shopCheckoutTax";
import { repriceShopSourceMoney, shopUahSaleRate } from "./shopPriceBookCurrency";

type Money = number | { toString(): string };
type QuoteOrder = {
  currency: string;
  taxAmount?: Money;
  pricingSnapshot: unknown;
  items: Array<{
    id: string;
    quantity: number;
    price: Money;
    total: Money;
    productSlug?: string;
    variantId?: string | null;
  }>;
};

export function snapshotRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cost(value: unknown) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(value)) ||
    !Number.isFinite(Number(value))
  )
    throw new Error("INVALID_DELIVERY_QUOTE_COST");
  return monobankMinorUnits(Number(value)) / 100;
}

export function calculateInternationalDeliveryQuote(
  order: QuoteOrder,
  rates: ShopCurrencyRates,
  shippingAmount: unknown,
  taxAmountUah?: unknown,
  shippingCurrency: unknown = "UAH"
) {
  if (!["UAH", "EUR", "USD"].includes(order.currency))
    throw new Error("UNSUPPORTED_ORDER_CURRENCY");
  const source = order.currency as ShopCurrencyCode;
  if (typeof shippingCurrency !== "string" || !["UAH", "EUR", "USD"].includes(shippingCurrency))
    throw new Error("UNSUPPORTED_SHIPPING_CURRENCY");
  const shippingSource = shippingCurrency as ShopCurrencyCode;
  if (
    ![rates[source], rates[shippingSource], rates.UAH].every(
      (rate) => Number.isFinite(rate) && rate > 0
    )
  )
    throw new Error("EXCHANGE_RATE_UNAVAILABLE");
  const shippingRateToUah = shopUahSaleRate(shippingSource, rates);
  if (!Number.isFinite(shippingRateToUah) || shippingRateToUah <= 0)
    throw new Error("EXCHANGE_RATE_UNAVAILABLE");
  const convert = (value: Money) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("INVALID_ORDER_AMOUNT");
    return Math.sign(number) * convertShopCurrencyAmount(Math.abs(number), source, "UAH", rates, 2);
  };
  const snapshot = snapshotRecord(order.pricingSnapshot);
  const originalSnapshot = snapshotRecord(snapshot.originalPricingSnapshot ?? snapshot);
  const sourceItems = Array.isArray(originalSnapshot.items)
    ? originalSnapshot.items.map(snapshotRecord)
    : [];
  const matchedSources = order.items.map((item) =>
    sourceItems.find(
      (saved) =>
        item.productSlug &&
        saved.slug === item.productSlug &&
        (saved.variantId ?? null) === (item.variantId ?? null)
    )
  );
  const items = order.items.map((item, index) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || Number(item.price) <= 0)
      throw new Error("INVALID_ORDER_LINE");
    const saved = matchedSources[index];
    const savedCurrency =
      typeof saved?.sourceAmount === "number" ? saved.sourceCurrency : originalSnapshot.currency;
    const savedAmount =
      typeof saved?.sourceAmount === "number" ? saved.sourceAmount : saved?.unitPrice;
    const hasSource =
      ["EUR", "USD", "UAH"].includes(String(savedCurrency)) &&
      typeof savedAmount === "number" &&
      Number.isFinite(savedAmount) &&
      savedAmount > 0;
    const currency = hasSource ? (savedCurrency as ShopCurrencyCode) : source;
    const amount = hasSource ? savedAmount : Number(item.price);
    const price =
      rates._uahReserve === 1 || hasSource
        ? monobankMinorUnits(
            repriceShopSourceMoney(
              {
                eur: currency === "EUR" ? amount : 0,
                usd: currency === "USD" ? amount : 0,
                uah: currency === "UAH" ? amount : 0,
                sourceCurrency: currency,
              },
              rates
            ).uah
          ) / 100
        : convert(item.price);
    const total = (monobankMinorUnits(price) * item.quantity) / 100;
    return { id: item.id, quantity: item.quantity, price, total };
  });
  const subtotal = items.reduce((sum, item) => sum + monobankMinorUnits(item.total), 0) / 100;
  const region = snapshotRecord(originalSnapshot.regionalPricingRule);
  const regionalAdjustmentAmount =
    rates._uahReserve === 1 && region.mode === "percent" && typeof region.value === "number"
      ? (Math.sign(region.value) * monobankMinorUnits((subtotal * Math.abs(region.value)) / 100)) /
        100
      : rates._uahReserve === 1 &&
          region.mode === "fixed" &&
          typeof region.value === "number" &&
          ["EUR", "USD", "UAH"].includes(String(region.currency))
        ? (Math.sign(region.value) *
            monobankMinorUnits(
              Math.abs(region.value) * shopUahSaleRate(region.currency as ShopCurrencyCode, rates)
            )) /
          100
        : convert(Number(snapshot.regionalAdjustmentAmount ?? 0));
  const shippingSourceAmount = cost(shippingAmount);
  const shippingCost = monobankMinorUnits(shippingSourceAmount * shippingRateToUah) / 100;
  const taxRegion = snapshotRecord(snapshot.taxRegion);
  const adjustedSubtotal = subtotal + regionalAdjustmentAmount;
  const originalAdjustedSubtotal =
    order.items.reduce((sum, item) => sum + Number(item.total), 0) +
    Number(snapshot.regionalAdjustmentAmount ?? 0);
  const sourceTaxable = matchedSources.every(
    (saved) => saved && ["default", "europe"].includes(String(saved.pricingBaseRegion))
  )
    ? items.reduce(
        (sum, item, index) =>
          sum + (matchedSources[index]!.pricingBaseRegion === "europe" ? item.total : 0),
        0
      )
    : undefined;
  const taxableAdjustment =
    sourceTaxable == null
      ? 0
      : Math.sign(regionalAdjustmentAmount) *
        calculateProportionalAmount(Math.abs(regionalAdjustmentAmount), sourceTaxable, subtotal);
  const taxableSubtotal =
    typeof snapshot.taxableSubtotal === "number"
      ? sourceTaxable != null
        ? sourceTaxable + taxableAdjustment
        : calculateProportionalAmount(
            adjustedSubtotal,
            snapshot.taxableSubtotal,
            originalAdjustedSubtotal
          )
      : undefined;
  const taxableShippingCost =
    taxableSubtotal == null
      ? undefined
      : calculateProportionalAmount(shippingCost, taxableSubtotal, adjustedSubtotal);
  if (["DDP", "DAP", "QUOTE"].includes(String(snapshotRecord(snapshot.landedCost).mode ?? "")))
    throw new Error("DELIVERY_IMPORT_COST_REVIEW_REQUIRED");
  const taxAmount =
    taxAmountUah != null
      ? cost(taxAmountUah)
      : typeof taxRegion.rate === "number" && taxableSubtotal != null
        ? calculateTaxAmount(
            { rate: taxRegion.rate, appliesToShipping: taxRegion.appliesToShipping === true },
            taxableSubtotal,
            taxableShippingCost ?? 0
          )
        : convert(order.taxAmount ?? 0);
  const total =
    (monobankMinorUnits(subtotal + regionalAdjustmentAmount) +
      monobankMinorUnits(shippingCost) +
      monobankMinorUnits(taxAmount)) /
    100;
  if (!items.length || total <= 0 || monobankMinorUnits(total) > 2_147_483_647)
    throw new Error("INVALID_DELIVERY_QUOTE_TOTAL");
  return {
    currency: "UAH" as const,
    items,
    subtotal,
    regionalAdjustmentAmount,
    shippingCost,
    shippingQuote: {
      amount: shippingSourceAmount,
      currency: shippingSource,
      amountUah: shippingCost,
      rateToUah: shippingRateToUah,
    },
    taxAmount,
    taxableSubtotal,
    taxableShippingCost,
    total,
    currencyRates: rates,
    sourceCurrency: source,
  };
}

export { internationalDeliveryAgreementMatches } from "./shopInternationalCheckout";
