export type CatalogBrochureLanguage = "ua" | "ru" | "en";
export type CatalogBrochureCurrency = "EUR" | "USD" | "UAH";
export type CatalogBrochureBranding = "onecompany" | "brand" | "none";
export type CatalogBrochureLayout = "single" | "double";

export type CatalogBrochureItemInput = {
  productId: string;
  priceOverride?: number | null;
  imageSource?: string | null;
};

export type CatalogBrochureRequest = {
  title: string;
  subtitle: string;
  language: CatalogBrochureLanguage;
  currency: CatalogBrochureCurrency;
  layout: CatalogBrochureLayout;
  branding: CatalogBrochureBranding;
  brandName?: string | null;
  showPrice: boolean;
  items: CatalogBrochureItemInput[];
};

export const CATALOG_BROCHURE_LANGUAGES: Array<{
  value: CatalogBrochureLanguage;
  label: string;
}> = [
  { value: "ua", label: "Українська" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export const CATALOG_BROCHURE_CURRENCIES: Array<{
  value: CatalogBrochureCurrency;
  label: string;
  symbol: string;
}> = [
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "UAH", label: "UAH", symbol: "₴" },
];

export const CATALOG_BROCHURE_LAYOUTS: Array<{
  value: CatalogBrochureLayout;
  label: string;
  description: string;
}> = [
  { value: "single", label: "1 товар / сторінка", description: "Велика презентаційна подача" },
  { value: "double", label: "2 товари / сторінка", description: "Компактніший каталог" },
];

export function catalogBrochurePrice(
  product: {
    priceEur?: number | null;
    priceUsd?: number | null;
    priceUah?: number | null;
  },
  currency: CatalogBrochureCurrency
) {
  const value =
    currency === "EUR"
      ? product.priceEur
      : currency === "USD"
        ? product.priceUsd
        : product.priceUah;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function roundCatalogPrice(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyCatalogBrochureDiscount(value: number, percent: number) {
  return roundCatalogPrice(Math.max(0, value * (1 - percent / 100)));
}

export function applyCatalogBrochureFixedDiscount(value: number, amount: number) {
  return roundCatalogPrice(Math.max(0, value - amount));
}

export function catalogBrochureProductPageCount(itemCount: number, layout: CatalogBrochureLayout) {
  if (!Number.isSafeInteger(itemCount) || itemCount < 0) return 0;
  return layout === "double" ? Math.ceil(itemCount / 2) : itemCount;
}

export function validateCatalogBrochureRequest(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Некоректні дані каталогу.";
  }
  const body = value as Record<string, unknown>;
  const text = (entry: unknown, max: number) =>
    typeof entry === "string" && entry.trim().length > 0 && entry.trim().length <= max;
  const money = (entry: unknown) =>
    entry == null ||
    (typeof entry === "number" &&
      Number.isFinite(entry) &&
      entry >= 0 &&
      entry <= 9999999999.99 &&
      Math.abs(entry * 100 - Math.round(entry * 100)) < 0.0001);

  if (!text(body.title, 140)) return "Вкажіть назву каталогу (до 140 символів).";
  if (!text(body.subtitle, 220)) return "Вкажіть підзаголовок каталогу (до 220 символів).";
  if (!["ua", "ru", "en"].includes(String(body.language))) return "Оберіть мову каталогу.";
  if (!["EUR", "USD", "UAH"].includes(String(body.currency))) return "Оберіть валюту каталогу.";
  if (!["single", "double"].includes(String(body.layout))) return "Оберіть розкладку каталогу.";
  if (!["onecompany", "brand", "none"].includes(String(body.branding)))
    return "Оберіть логотип каталогу.";
  if (
    body.branding === "brand" &&
    (typeof body.brandName !== "string" ||
      !body.brandName.trim() ||
      body.brandName.trim().length > 120)
  ) {
    return "Оберіть бренд для логотипа каталогу.";
  }
  if (
    body.brandName != null &&
    (typeof body.brandName !== "string" || body.brandName.length > 120)
  ) {
    return "Некоректна назва бренду.";
  }
  if (typeof body.showPrice !== "boolean") return "Некоректне налаштування відображення ціни.";
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) {
    return "Додайте від 1 до 40 товарів.";
  }

  const ids = new Set<string>();
  for (const [index, entry] of body.items.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return `Перевірте товар у позиції ${index + 1}.`;
    }
    const item = entry as Record<string, unknown>;
    if (
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      item.productId.length > 100
    ) {
      return `Перевірте товар у позиції ${index + 1}.`;
    }
    if (ids.has(item.productId)) return "Один і той самий товар не можна додати двічі.";
    ids.add(item.productId);
    if (!money(item.priceOverride)) {
      return `Ціна в позиції ${index + 1} має бути невід’ємною сумою з точністю до копійок.`;
    }
    if (
      item.imageSource != null &&
      (typeof item.imageSource !== "string" ||
        !item.imageSource.trim() ||
        item.imageSource.length > 2048 ||
        /[\u0000-\u001f\u007f]/.test(item.imageSource))
    ) {
      return `Перевірте фото товару в позиції ${index + 1}.`;
    }
  }
  return null;
}
