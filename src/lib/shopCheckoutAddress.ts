/**
 * Which delivery fields checkout requires for a country. Client-safe: the region
 * lists themselves live server-side (`shopCountryRegions.server.ts`).
 */

// Countries whose postal system has no postcodes (or where carriers never ask
// for one). Everywhere else the postcode is required.
const COUNTRIES_WITHOUT_POSTCODE = new Set([
  "AE", "AG", "AN", "AO", "AW", "BF", "BI", "BJ", "BO", "BS", "BW", "BZ", "CD", "CF", "CG",
  "CI", "CK", "CM", "CW", "DJ", "DM", "ER", "FJ", "GA", "GD", "GH", "GM", "GQ", "GY", "HK",
  "JM", "KI", "KM", "KN", "KP", "LY", "ML", "MO", "MR", "MW", "NR", "NU", "QA", "RW", "SB",
  "SC", "SL", "SO", "SR", "SS", "ST", "SX", "SY", "TD", "TF", "TG", "TK", "TL", "TO", "TT",
  "TV", "UG", "VU", "YE", "ZW",
]);

export function shopCountryUsesPostcode(countryCode: string | null | undefined) {
  return !COUNTRIES_WITHOUT_POSTCODE.has(String(countryCode ?? "").toUpperCase());
}

/**
 * The name stored on the order. The surname is validated on its own, so it must never
 * be lost: first + last name when both are sent, otherwise the full name with the
 * surname appended unless the name already contains it as a whole word.
 */
export function shopCheckoutCustomerName(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const clean = (value?: string | null) => String(value ?? "").trim().replace(/\s+/g, " ");
  const name = clean(input.name);
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  if (!name && !firstName) return "";
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (!lastName) return name || firstName;
  return ` ${name.toLocaleLowerCase()} `.includes(` ${lastName.toLocaleLowerCase()} `)
    ? name
    : `${name} ${lastName}`;
}

export type ShopCheckoutAddressField = "lastName" | "phone" | "line2" | "region" | "postcode";

/** Fields the buyer left empty, beyond the always-checked email/name/line1/city/country. */
export function missingShopCheckoutFields(input: {
  lastName?: string | null;
  phone?: string | null;
  line2?: string | null;
  region?: string | null;
  postcode?: string | null;
  countryCode?: string | null;
  countryHasRegions: boolean;
}): ShopCheckoutAddressField[] {
  const blank = (value?: string | null) => !String(value ?? "").trim();
  const missing: ShopCheckoutAddressField[] = [];
  if (blank(input.lastName)) missing.push("lastName");
  if (blank(input.phone)) missing.push("phone");
  if (blank(input.line2)) missing.push("line2");
  if (input.countryHasRegions && blank(input.region)) missing.push("region");
  if (shopCountryUsesPostcode(input.countryCode) && blank(input.postcode)) missing.push("postcode");
  return missing;
}
