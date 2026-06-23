import { EU_VAT_COUNTRIES } from "@/lib/shopEuVat";

/**
 * Country list used by the storefront country picker and checkout address form.
 *
 * The canonical `value` is an English country/territory name so it stays readable
 * in saved addresses and checkout snapshots. EU names are sourced from the VAT
 * table, which keeps country matching aligned with the admin tax rules.
 */
export type ShopCountry = {
  code: string;
  value: string;
  ua: string;
  en: string;
  aliases?: readonly string[];
};

const COUNTRY_CODES = [
  "UA",
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "MD",
  "GB",
  "CH",
  "NO",
  "IS",
  "LI",
  "US",
  "CA",
  "AE",
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BF",
  "BI",
  "CV",
  "KH",
  "CM",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "CU",
  "CW",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "GH",
  "GI",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IM",
  "IL",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LB",
  "LS",
  "LR",
  "LY",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PR",
  "QA",
  "RE",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
] as const;

type CountryCode = (typeof COUNTRY_CODES)[number];

type DisplayNamesConstructor = new (
  locales?: string | string[],
  options?: { type: "region" }
) => { of(code: string): string | undefined };

const DisplayNames = (Intl as typeof Intl & { DisplayNames?: DisplayNamesConstructor })
  .DisplayNames;

const ENGLISH_REGION_NAMES = DisplayNames ? new DisplayNames(["en"], { type: "region" }) : null;

const UKRAINIAN_REGION_NAMES = DisplayNames ? new DisplayNames(["uk"], { type: "region" }) : null;

const EU_COUNTRY_BY_CODE = new Map(EU_VAT_COUNTRIES.map((country) => [country.code, country]));

const VALUE_OVERRIDES: Partial<Record<CountryCode, string>> = {
  GB: "United Kingdom",
  US: "United States",
  AE: "United Arab Emirates",
  MD: "Moldova",
};

const ALIAS_OVERRIDES: Partial<Record<CountryCode, readonly string[]>> = {
  GB: ["UK", "Great Britain", "Britain"],
  US: ["USA", "United States of America"],
  MD: ["Republic of Moldova"],
  CH: ["Swiss Confederation"],
};

function displayRegion(
  displayNames: { of(code: string): string | undefined } | null,
  code: CountryCode
) {
  return displayNames?.of(code) ?? code;
}

function englishCountryName(code: CountryCode) {
  return (
    VALUE_OVERRIDES[code] ??
    EU_COUNTRY_BY_CODE.get(code)?.name ??
    displayRegion(ENGLISH_REGION_NAMES, code)
  );
}

export const SHOP_COUNTRIES: ReadonlyArray<ShopCountry> = [
  ...COUNTRY_CODES.map((code) => {
    const euCountry = EU_COUNTRY_BY_CODE.get(code);
    const en = englishCountryName(code);
    return {
      code,
      value: en,
      en,
      ua: displayRegion(UKRAINIAN_REGION_NAMES, code),
      aliases: [...(euCountry?.aliases ?? []), ...(ALIAS_OVERRIDES[code] ?? [])],
    } satisfies ShopCountry;
  }),
  { code: "ZZ", value: "Other", ua: "Інша країна", en: "Other" },
];

function normalizeCountryToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

const COUNTRY_BY_TOKEN = new Map<string, ShopCountry>();

for (const country of SHOP_COUNTRIES) {
  for (const value of [
    country.code,
    country.value,
    country.en,
    country.ua,
    ...(country.aliases ?? []),
  ]) {
    const normalized = normalizeCountryToken(value);
    if (normalized) COUNTRY_BY_TOKEN.set(normalized, country);
  }
}

export function resolveShopCountry(value: string | null | undefined): ShopCountry | null {
  const normalized = normalizeCountryToken(value);
  return normalized ? (COUNTRY_BY_TOKEN.get(normalized) ?? null) : null;
}

export function isKnownShopCountry(value: string | null | undefined): boolean {
  return Boolean(resolveShopCountry(value));
}
