/**
 * Curated list of countries we currently ship to. Used by checkout + cabinet
 * address forms so storage stays consistent (no "укр" / "Україна" / "UKR" mix).
 *
 * Add countries here when shipping rules in admin support them — keep the
 * canonical `value` in English so it matches `ShopShippingZone.countries`.
 */
export type ShopCountry = {
  value: string;
  ua: string;
  en: string;
};

export const SHOP_COUNTRIES: ReadonlyArray<ShopCountry> = [
  { value: 'Ukraine', ua: 'Україна', en: 'Ukraine' },
  { value: 'Poland', ua: 'Польща', en: 'Poland' },
  { value: 'Germany', ua: 'Німеччина', en: 'Germany' },
  { value: 'Czech Republic', ua: 'Чехія', en: 'Czech Republic' },
  { value: 'Slovakia', ua: 'Словаччина', en: 'Slovakia' },
  { value: 'Romania', ua: 'Румунія', en: 'Romania' },
  { value: 'Hungary', ua: 'Угорщина', en: 'Hungary' },
  { value: 'Lithuania', ua: 'Литва', en: 'Lithuania' },
  { value: 'Latvia', ua: 'Латвія', en: 'Latvia' },
  { value: 'Estonia', ua: 'Естонія', en: 'Estonia' },
  { value: 'Moldova', ua: 'Молдова', en: 'Moldova' },
  { value: 'United Kingdom', ua: 'Великобританія', en: 'United Kingdom' },
  { value: 'Italy', ua: 'Італія', en: 'Italy' },
  { value: 'France', ua: 'Франція', en: 'France' },
  { value: 'Spain', ua: 'Іспанія', en: 'Spain' },
  { value: 'Netherlands', ua: 'Нідерланди', en: 'Netherlands' },
  { value: 'Belgium', ua: 'Бельгія', en: 'Belgium' },
  { value: 'Austria', ua: 'Австрія', en: 'Austria' },
  { value: 'Switzerland', ua: 'Швейцарія', en: 'Switzerland' },
  { value: 'United States', ua: 'США', en: 'United States' },
  { value: 'Canada', ua: 'Канада', en: 'Canada' },
  { value: 'United Arab Emirates', ua: 'ОАЕ', en: 'United Arab Emirates' },
  { value: 'Other', ua: 'Інша країна', en: 'Other' },
];

const VALUE_SET = new Set(SHOP_COUNTRIES.map((c) => c.value));

export function isKnownShopCountry(value: string | null | undefined): boolean {
  if (!value) return false;
  return VALUE_SET.has(value);
}
