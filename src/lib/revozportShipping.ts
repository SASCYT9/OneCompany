/**
 * Shipping quotes supplied by Revozport's inventory/pricing workbooks.
 *
 * Checkout converts these USD source quotes into the selected checkout
 * currency. The official product price remains separate from freight.
 */

export const REVOZPORT_LOGISTICS_NAMESPACE = "revozport_logistics";
export const REVOZPORT_SEA_SHIPPING_KEY = "sea_shipping_usd";
export const REVOZPORT_AIR_SHIPPING_KEY = "air_shipping_usd";

export type RevozportShippingQuotes = {
  seaUsd: number | null;
  airUsd: number | null;
};

function parseQuote(value: unknown): number | null {
  const raw = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseRevozportShippingQuotes(
  metafields: Array<{ namespace?: string | null; key?: string | null; value?: string | null }>
): RevozportShippingQuotes {
  const read = (key: string) =>
    metafields.find(
      (metafield) => metafield.namespace === REVOZPORT_LOGISTICS_NAMESPACE && metafield.key === key
    )?.value;

  return {
    seaUsd: parseQuote(read(REVOZPORT_SEA_SHIPPING_KEY)),
    airUsd: parseQuote(read(REVOZPORT_AIR_SHIPPING_KEY)),
  };
}

export function isUkraineShippingZone(zone: { countries?: string[] } | null | undefined) {
  return (zone?.countries ?? []).some((country) => {
    const normalized = String(country ?? "")
      .trim()
      .toLowerCase();
    return normalized === "ua" || normalized === "ukraine" || normalized === "україна";
  });
}
