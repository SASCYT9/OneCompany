import { EU_VAT_COUNTRIES } from "@/lib/shopEuVat";

type EuropePricingCountry = {
  code: string;
  name: string;
  aliases?: string[];
};

const NON_EU_EUROPE_PRICING_COUNTRIES: readonly EuropePricingCountry[] = [
  { code: "CH", name: "Switzerland", aliases: ["Swiss Confederation"] },
  { code: "GB", name: "United Kingdom", aliases: ["UK", "Great Britain", "Britain"] },
  { code: "MD", name: "Moldova", aliases: ["Republic of Moldova"] },
  { code: "NO", name: "Norway" },
  { code: "IS", name: "Iceland" },
  { code: "LI", name: "Liechtenstein" },
] as const;

function normalizeCountryToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

const EUROPE_PRICING_COUNTRY_LOOKUP = new Set<string>();

for (const country of [...EU_VAT_COUNTRIES, ...NON_EU_EUROPE_PRICING_COUNTRIES]) {
  EUROPE_PRICING_COUNTRY_LOOKUP.add(normalizeCountryToken(country.code));
  EUROPE_PRICING_COUNTRY_LOOKUP.add(normalizeCountryToken(country.name));
  for (const alias of country.aliases ?? []) {
    EUROPE_PRICING_COUNTRY_LOOKUP.add(normalizeCountryToken(alias));
  }
}

export function isEuropePricingCountry(value: string | null | undefined): boolean {
  const normalized = normalizeCountryToken(value);
  return normalized ? EUROPE_PRICING_COUNTRY_LOOKUP.has(normalized) : false;
}
