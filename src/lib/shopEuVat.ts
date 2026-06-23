export type EuVatCountry = {
  code: string;
  name: string;
  standardRate: number;
  aliases?: string[];
};

export const EU_VAT_COUNTRIES: readonly EuVatCountry[] = [
  { code: "AT", name: "Austria", standardRate: 0.2 },
  { code: "BE", name: "Belgium", standardRate: 0.21 },
  { code: "BG", name: "Bulgaria", standardRate: 0.2 },
  { code: "CY", name: "Cyprus", standardRate: 0.19 },
  { code: "CZ", name: "Czech Republic", standardRate: 0.21, aliases: ["Czechia"] },
  { code: "DE", name: "Germany", standardRate: 0.19 },
  { code: "DK", name: "Denmark", standardRate: 0.25 },
  { code: "EE", name: "Estonia", standardRate: 0.24 },
  { code: "ES", name: "Spain", standardRate: 0.21 },
  { code: "FI", name: "Finland", standardRate: 0.255 },
  { code: "FR", name: "France", standardRate: 0.2 },
  { code: "GR", name: "Greece", standardRate: 0.24, aliases: ["EL"] },
  { code: "HR", name: "Croatia", standardRate: 0.25 },
  { code: "HU", name: "Hungary", standardRate: 0.27 },
  { code: "IE", name: "Ireland", standardRate: 0.23 },
  { code: "IT", name: "Italy", standardRate: 0.22 },
  { code: "LT", name: "Lithuania", standardRate: 0.21 },
  { code: "LU", name: "Luxembourg", standardRate: 0.17 },
  { code: "LV", name: "Latvia", standardRate: 0.21 },
  { code: "MT", name: "Malta", standardRate: 0.18 },
  { code: "NL", name: "Netherlands", standardRate: 0.21 },
  { code: "PL", name: "Poland", standardRate: 0.23 },
  { code: "PT", name: "Portugal", standardRate: 0.23 },
  { code: "RO", name: "Romania", standardRate: 0.21 },
  { code: "SE", name: "Sweden", standardRate: 0.25 },
  { code: "SI", name: "Slovenia", standardRate: 0.22 },
  { code: "SK", name: "Slovakia", standardRate: 0.23 },
] as const;

function normalizeCountryToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

const EU_COUNTRY_LOOKUP = new Map<string, EuVatCountry>();

for (const country of EU_VAT_COUNTRIES) {
  EU_COUNTRY_LOOKUP.set(normalizeCountryToken(country.code), country);
  EU_COUNTRY_LOOKUP.set(normalizeCountryToken(country.name), country);
  for (const alias of country.aliases ?? []) {
    EU_COUNTRY_LOOKUP.set(normalizeCountryToken(alias), country);
  }
}

export function resolveEuVatCountry(value: string | null | undefined): EuVatCountry | null {
  const normalized = normalizeCountryToken(value);
  return normalized ? (EU_COUNTRY_LOOKUP.get(normalized) ?? null) : null;
}

export function isEuVatCountry(value: string | null | undefined): boolean {
  return Boolean(resolveEuVatCountry(value));
}
