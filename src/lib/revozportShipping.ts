/**
 * Revozport shipping inputs.
 *
 * The current supplier rule is a worldwide rate of $25 per kilogram. The
 * requested 10% safety reserve applies only to weights we estimate when the
 * workbook has no shipping weight. The
 * workbook sea/air quotes remain available as source data and a fallback for
 * legacy products that do not yet have a usable shipping weight.
 */

export const REVOZPORT_LOGISTICS_NAMESPACE = "revozport_logistics";
export const REVOZPORT_SEA_SHIPPING_KEY = "sea_shipping_usd";
export const REVOZPORT_AIR_SHIPPING_KEY = "air_shipping_usd";
export const REVOZPORT_SHIPPING_RATE_USD_PER_KG = 25;
export const REVOZPORT_USD_TO_UAH_RATE = 46;

export type RevozportCurrencyRates = {
  EUR: number;
  USD: number;
  UAH: number;
};

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

export function isRevozportBrand(brandName: string | null | undefined) {
  return (
    String(brandName ?? "")
      .trim()
      .toLowerCase() === "revozport"
  );
}

export function isUkraineCountry(country: string | null | undefined) {
  const normalized = String(country ?? "")
    .trim()
    .toLowerCase();
  return normalized === "ua" || normalized === "ukraine" || normalized === "україна";
}

export function calculateRevozportShippingUsd(weightKg: number | null | undefined) {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return weight * REVOZPORT_SHIPPING_RATE_USD_PER_KG;
}

export function addRevozportUkraineShippingToPriceSet(
  price: { eur: number; usd: number; uah: number },
  brandName: string | null | undefined,
  country: string | null | undefined,
  weightKg: number | null | undefined,
  rates: RevozportCurrencyRates
) {
  if (!isRevozportBrand(brandName) || !isUkraineCountry(country)) return price;
  const shippingUsd = calculateRevozportShippingUsd(weightKg);
  if (shippingUsd == null) return price;

  const hasValue = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const eurRate = rates.EUR > 0 ? rates.EUR : 1;
  const usdRate = rates.USD > 0 ? rates.USD : 1.152174;

  // Revozport imports are normally USD-only. Complete the product price
  // before adding shipping; otherwise missing EUR/UAH fields would contain
  // only the delivery amount. Ukraine uses the agreed fixed rate of 46 UAH/USD.
  const basePrice = hasValue(price.usd)
    ? {
        usd: price.usd,
        eur: (price.usd / usdRate) * eurRate,
        uah: price.usd * REVOZPORT_USD_TO_UAH_RATE,
      }
    : hasValue(price.eur)
      ? {
          eur: price.eur,
          usd: (price.eur / eurRate) * usdRate,
          uah: (price.eur / eurRate) * usdRate * REVOZPORT_USD_TO_UAH_RATE,
        }
      : hasValue(price.uah)
        ? {
            uah: price.uah,
            usd: price.uah / REVOZPORT_USD_TO_UAH_RATE,
            eur: (price.uah / REVOZPORT_USD_TO_UAH_RATE / usdRate) * eurRate,
          }
        : price;

  const shippingEur = (shippingUsd / usdRate) * eurRate;
  const shippingUah = shippingUsd * REVOZPORT_USD_TO_UAH_RATE;

  return {
    eur: basePrice.eur + shippingEur,
    usd: basePrice.usd + shippingUsd,
    uah: basePrice.uah + shippingUah,
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

