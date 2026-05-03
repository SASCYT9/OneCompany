import { DEFAULT_CURRENCY_RATES, type ShopCurrencyCode } from "@/lib/shopAdminSettings";

/**
 * National Bank of Ukraine daily official rates.
 *
 * Endpoint: https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json
 * Returns an array of `{ cc, rate, ... }` where `rate` is UAH per one unit
 * of the foreign currency.
 *
 * Our internal rate model is normalised to EUR=1, so we convert NBU's
 * UAH-per-X table into a EUR-per-X table:
 *   rates.EUR = 1
 *   rates.USD = nbu.EUR / nbu.USD     (USD per 1 EUR)
 *   rates.UAH = nbu.EUR / nbu.UAH = nbu.EUR  (UAH per 1 EUR)
 *
 * Result is cached for one hour at the network layer (NBU updates once a
 * working day, an hour is plenty without making the page hot path slow).
 */

const NBU_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";

type NbuRow = { cc: string; rate: number };

export async function getNbuRates(): Promise<Record<ShopCurrencyCode, number>> {
  try {
    const res = await fetch(NBU_URL, {
      next: { revalidate: 3600, tags: ["nbu-rates"] },
    });
    if (!res.ok) {
      return { ...DEFAULT_CURRENCY_RATES };
    }
    const rows = (await res.json()) as NbuRow[];
    const map = Object.fromEntries(rows.map((r) => [r.cc, r.rate]));
    const usdToUah = map.USD;
    const eurToUah = map.EUR;
    if (!usdToUah || !eurToUah || usdToUah <= 0 || eurToUah <= 0) {
      return { ...DEFAULT_CURRENCY_RATES };
    }
    return {
      EUR: 1,
      USD: eurToUah / usdToUah,
      UAH: eurToUah,
    };
  } catch {
    return { ...DEFAULT_CURRENCY_RATES };
  }
}
