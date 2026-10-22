/**
 * Where the prices of each brand on the site come from, and how the price
 * watch keeps an eye on them. The list lives in code so a change is reviewed;
 * the database only keeps the progress of checks (OpsPriceWatchSource) and
 * what they found (OpsPriceWatchRun). Texts are Russian, like the rest of the bot.
 *
 * - formula: the supplier's site is read and our formula recalculated; the
 *   result is compared with the price on our site.
 * - changes: the supplier's site is read and compared with the previous check
 *   (our formula for the brand is not in code yet).
 * - atomic: prices already follow the Atomic feed every 3 hours; only the sync
 *   itself is watched.
 * - price_list: prices come from a PDF/Excel/CSV price list; the bot reminds
 *   when it is time to ask the supplier for a new one.
 * - planned: not checked automatically yet.
 * - competitor: a Ukrainian shop selling the same SKUs; our price in hryvnias
 *   is compared with theirs.
 * - fx: fixed exchange rates inside formulas compared with the NBU rate.
 *
 * Every check also records, for us only, the supplier's stock and the weight
 * it publishes (OpsSupplierItem), and remembers supplier items we do not sell.
 */

import { CT_CARBON_GBP_USD } from "@/lib/ctCarbonCatalog";
import { MST_GBP_TO_USD_RATE } from "@/lib/mstCatalog";

export type PriceWatchKind =
  | "formula"
  | "changes"
  | "atomic"
  | "price_list"
  | "planned"
  | "competitor"
  | "fx";
export type PriceWatchCheck =
  | "ct-carbon"
  | "link-ecu"
  | "brabus"
  | "mst"
  | "shopify-changes"
  | "atomic"
  | "import-facts"
  | "competitor-atomic"
  | "competitor-adrenalin"
  | "fx";
export type PriceWatchCurrency = "EUR" | "USD" | "GBP" | "UAH";

export type PriceWatchShopifyFeed = {
  base: string;
  collection?: string;
  query?: string;
  /**
   * How a supplier variant is found for our product: by SKU, by the Shopify ids
   * inside Burger SKUs, or by the supplier page URL the import kept (iPE).
   */
  match: "sku" | "burger" | "handle";
  /**
   * Shopify Markets country whose prices the formula starts from. Some stores
   * price by the visitor's country (CT Carbon: Germany pays 2.4 % more).
   */
  market?: string;
};

export type PriceWatchSourceDefinition = {
  key: string;
  title: string;
  /** ShopProduct.brand values priced by this source. */
  brands: readonly string[];
  kind: PriceWatchKind;
  check?: PriceWatchCheck;
  /** Where the price comes from, for people. */
  site: string;
  url?: string;
  formula: string;
  /** Formula checks: currency of our price. Change checks: the supplier's currency. */
  currency?: PriceWatchCurrency;
  everyHours?: number;
  /** Page-by-page sources: product pages read per cron run. */
  pagesPerRun?: number;
  shopify?: PriceWatchShopifyFeed;
  priceList?: {
    label: string;
    date: string;
    everyDays: number;
    /** A plain SKU + price file sent to the bot becomes site prices × this markup. */
    file?: { markup: number };
  };
  note?: string;
};

export const PRICE_WATCH_SOURCES: readonly PriceWatchSourceDefinition[] = [
  {
    key: "ct-carbon",
    title: "CT Carbon",
    brands: ["CT Carbon"],
    kind: "formula",
    check: "ct-carbon",
    site: "ctcarbon.co",
    url: "https://www.ctcarbon.co",
    formula:
      "(цена сайта £ с НДС × 1,15 + доставка до Медики £) × 1,345 + доставка в Украину $, вверх до $5",
    currency: "USD",
    everyHours: 24,
  },
  {
    key: "brabus",
    title: "Brabus",
    brands: ["Brabus"],
    kind: "formula",
    check: "brabus",
    site: "brabus.com (DE)",
    url: "https://www.brabus.com/de-de",
    formula: "цена brabus.com (DE) × 1,10",
    currency: "EUR",
    everyHours: 7 * 24,
    pagesPerRun: 70,
  },
  {
    key: "link-ecu",
    title: "Link ECU",
    brands: ["Link ECU"],
    kind: "formula",
    check: "link-ecu",
    site: "linkecu.com",
    url: "https://linkecu.com",
    formula: "EU RRP × 1,20, вверх до 1 €",
    currency: "EUR",
    everyHours: 24,
  },
  {
    key: "mst",
    title: "MST Performance",
    brands: ["MST Performance"],
    kind: "formula",
    check: "mst",
    site: "sendit.parts",
    url: "https://sendit.parts",
    formula: "цена Sendit £ с НДС × 1,10 × 1,37, вверх до $5",
    currency: "USD",
    everyHours: 7 * 24,
    pagesPerRun: 60,
  },
  {
    key: "burger",
    title: "Burger Motorsports",
    brands: ["Burger Motorsports"],
    kind: "changes",
    check: "shopify-changes",
    site: "burgertuning.com",
    url: "https://burgertuning.com",
    formula: "цена сайта + 10 % + доставка до Нью-Йорка + вес в Украину",
    currency: "USD",
    everyHours: 24,
    shopify: { base: "https://burgertuning.com", match: "burger" },
  },
  {
    key: "girodisc",
    title: "GiroDisc",
    brands: ["GiroDisc"],
    kind: "changes",
    check: "shopify-changes",
    site: "atomic-shop.ua",
    url: "https://atomic-shop.ua/collections/girodisc",
    formula: "по цене Atomic (формула не подтверждена)",
    currency: "UAH",
    everyHours: 24,
    shopify: { base: "https://atomic-shop.ua", collection: "girodisc", match: "sku" },
  },
  {
    key: "atomic",
    title: "Akrapovič · Öhlins · CSF · ADRO",
    brands: ["AKRAPOVIC", "OHLINS", "CSF", "ADRO"],
    kind: "atomic",
    check: "atomic",
    site: "фид Atomic",
    url: "https://atomic-shop.ua",
    formula: "цена Atomic (грн) ÷ 52, мото −3 %; сайт обновляется сам каждые 3 часа",
    everyHours: 24,
  },
  {
    key: "ipe",
    title: "iPE",
    brands: ["iPE exhaust"],
    kind: "price_list",
    check: "shopify-changes",
    site: "прайс iPE (USD)",
    url: "https://ipeofficial.com",
    formula: "цена прайса + доставка и растаможка",
    currency: "USD",
    everyHours: 24,
    shopify: { base: "https://ipeofficial.com", match: "handle" },
    priceList: { label: "прайс iPE «апрель 2026» (USD)", date: "2026-04-01", everyDays: 180 },
  },
  {
    key: "remus",
    title: "Remus",
    brands: ["Remus"],
    kind: "price_list",
    site: "CSV-выгрузка (GBP)",
    formula: "цена выгрузки (GBP), пересчитанная в евро",
    priceList: { label: "CSV-выгрузка Remus (GBP)", date: "2026-05-20", everyDays: 90 },
  },
  {
    key: "dinan",
    title: "Dinan",
    brands: ["Dinan"],
    kind: "price_list",
    // Weight and MAP come from the price list kept at import; no supplier request.
    check: "import-facts",
    everyHours: 7 * 24,
    site: "дилерский прайс (Excel)",
    url: "https://www.dinancars.com",
    formula: "MAP × 1,15 + $12/кг (без MAP — MSRP); не выше конкурента, не ниже MAP + $12/кг",
    priceList: { label: "дилерский прайс Dinan (MSRP и MAP)", date: "2026-10-19", everyDays: 90 },
  },
  {
    key: "apr",
    title: "APR",
    brands: ["APR"],
    kind: "price_list",
    check: "import-facts",
    everyHours: 7 * 24,
    site: "дилерский прайс (Excel)",
    url: "https://www.goapr.com",
    formula: "MAP × 1,15 + $12/кг (без MAP — MSRP); не выше конкурента, не ниже MAP + $12/кг",
    priceList: { label: "дилерский прайс APR (MSRP и MAP)", date: "2026-10-19", everyDays: 90 },
  },
  {
    key: "revozport",
    title: "Revozport",
    brands: ["Revozport"],
    kind: "price_list",
    check: "shopify-changes",
    site: "прайс Revozport (Excel)",
    url: "https://revozport.com",
    formula: "цена прайса Revozport",
    currency: "USD",
    everyHours: 24,
    shopify: { base: "https://revozport.com", match: "sku" },
    priceList: {
      label: "прайс Revozport (Excel от 14.09)",
      date: "2026-09-14",
      everyDays: 60,
      file: { markup: 1 },
    },
  },
  {
    key: "fi-exhaust",
    title: "Fi Exhaust",
    brands: ["Fi EXHAUST"],
    kind: "price_list",
    site: "прайс Fi Exhaust (USD)",
    formula: "цена прайса + 1 000–1 200 $ доставка и растаможка",
    priceList: { label: "прайс Fi Exhaust (USD)", date: "2026-09-03", everyDays: 120 },
  },
  {
    key: "eventuri",
    title: "Eventuri",
    brands: ["Eventuri"],
    kind: "price_list",
    site: "прайс IND (USD)",
    formula: "цена IND + 10 %",
    priceList: {
      label: "прайс IND по Eventuri (USD)",
      date: "2026-09-02",
      everyDays: 90,
      file: { markup: 1.1 },
    },
  },
  {
    key: "do88",
    title: "DO88 · Garrett · Setrab · GFB",
    brands: ["DO88", "Garrett", "Setrab", "GFB"],
    kind: "planned",
    site: "do88performance.eu",
    url: "https://www.do88performance.eu",
    formula: "цена Consumer с НДС + 5 %",
    note: "Проверка сайта — следующий этап",
  },
  {
    key: "kw",
    title: "KW",
    brands: ["KW Suspensions"],
    kind: "planned",
    site: "сайт KW",
    formula: "цена сайта KW",
    note: "Нужно подтвердить, с какого сайта KW берётся цена",
  },
  {
    key: "bmc",
    title: "BMC",
    brands: ["BMC"],
    kind: "planned",
    site: "bmcairfilters.com",
    url: "https://www.bmcairfilters.com",
    formula: "ориентир — цены Turn14",
    note: "Проверка сайта — следующий этап",
  },
  {
    key: "ilmberger",
    title: "Ilmberger Carbon",
    brands: ["Ilmberger Carbon"],
    kind: "planned",
    site: "ilmberger-carbon.com",
    url: "https://ilmberger-carbon.com",
    formula: "формула не подтверждена",
    note: "Проверка сайта — следующий этап",
  },
  {
    key: "wheelforce",
    title: "WheelForce",
    brands: ["WheelForce"],
    kind: "planned",
    site: "wheelforce.de",
    url: "https://wheelforce.de",
    formula: "четыре диска производителя × 1,10",
    note: "Проверка сайта — следующий этап",
  },
  {
    key: "urban",
    title: "Urban Automotive",
    brands: [
      "Range Rover",
      "Land Rover",
      "Mercedes-Benz",
      "Audi",
      "Lamborghini",
      "Volkswagen",
      "Bentley",
      "Rolls-Royce",
    ],
    kind: "planned",
    site: "портал Urban",
    formula: "нетто + 20 % + 10 %",
    note: "Цены дилерского портала — нужен вход в портал",
  },
  {
    key: "racechip",
    title: "RaceChip",
    brands: ["RaceChip"],
    kind: "planned",
    site: "racechip.eu",
    url: "https://www.racechip.eu",
    formula: "цена сайта, старший уровень с App Control",
    note: "Сайт закрыт Cloudflare — нужна проверка через браузер",
  },
  {
    key: "small-usa",
    title: "BootMod3 · G-Sport · STOPFLEX",
    brands: ["BootMod3", "G-Sport by GESi", "STOPFLEX"],
    kind: "planned",
    site: "сайты брендов",
    formula: "формула не подтверждена",
    note: "Мало товаров — проверка позже",
  },
  {
    key: "competitor-atomic",
    title: "Atomic",
    brands: [],
    kind: "competitor",
    check: "competitor-atomic",
    site: "atomic-shop.ua",
    url: "https://atomic-shop.ua",
    // Akrapovič, Öhlins, CSF and ADRO are priced as Atomic ÷ 52: a stronger
    // euro makes us dearer than Atomic without any price change.
    formula: "наша цена в гривнах против розничной цены Atomic",
    everyHours: 24,
  },
  {
    key: "competitor-adrenalin",
    title: "Adrenalin Drive",
    brands: [],
    kind: "competitor",
    check: "competitor-adrenalin",
    site: "shop.a-drive.com.ua",
    url: "https://shop.a-drive.com.ua",
    formula: "наша цена в гривнах против цены Adrenalin Drive",
    everyHours: 7 * 24,
    pagesPerRun: 70,
  },
  {
    key: "fx",
    title: "Курс фунта",
    brands: [],
    kind: "fx",
    check: "fx",
    site: "НБУ",
    url: "https://bank.gov.ua",
    formula: "GBP/USD в формулах CT Carbon (1,345) и MST (1,37)",
    everyHours: 24,
  },
];

export function findPriceWatchSource(key: string) {
  return PRICE_WATCH_SOURCES.find((source) => source.key === key) ?? null;
}

/** Fixed GBP/USD rates written into formulas, compared with the NBU cross rate. */
export const PRICE_WATCH_FORMULA_FX = [
  { source: "CT Carbon", gbpUsd: CT_CARBON_GBP_USD },
  { source: "MST Performance", gbpUsd: MST_GBP_TO_USD_RATE },
] as const;

/** A formula rate further than this from the NBU rate is reported. */
export const PRICE_WATCH_FX_ALERT_PCT = 3;
