import {
  convertShopCurrencyAmount,
  type ShopCurrencyCode,
  type ShopCurrencyRates,
} from "@/lib/shopMoneyFormat";
import type { ProformaOrder } from "./orderProforma";
export const proformaCurrencies = ["EUR", "USD", "UAH"] as const;
export function convertProforma(
  order: ProformaOrder,
  target: string,
  rawRates: unknown
): ProformaOrder {
  if (!proformaCurrencies.includes(target as ShopCurrencyCode))
    throw new Error("Unsupported currency");
  if (target === order.currency) return order;
  const rates = rawRates as ShopCurrencyRates | null;
  const source = order.currency as ShopCurrencyCode;
  if (
    !proformaCurrencies.includes(source) ||
    !rates ||
    ![rates[source], rates[target as ShopCurrencyCode]].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v > 0
    )
  )
    throw new Error("Exchange rate unavailable");
  const convert = (value: number) =>
    convertShopCurrencyAmount(value, source, target as ShopCurrencyCode, rates, 2);
  return {
    ...order,
    currency: target,
    conversionNote: `1 ${source} = ${(rates[target as ShopCurrencyCode] / rates[source]).toFixed(6)} ${target}`,
    subtotal: convert(order.subtotal),
    shippingCost: convert(order.shippingCost),
    taxAmount: convert(order.taxAmount),
    total: convert(order.total),
    amountPaid: convert(order.amountPaid),
    items: order.items.map((item) => ({
      ...item,
      price: convert(item.price),
      total: convert(item.total),
    })),
  };
}
