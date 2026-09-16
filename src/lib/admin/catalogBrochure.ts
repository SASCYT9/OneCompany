export type CatalogBrochureLanguage = "ua" | "ru" | "en";
export type CatalogBrochureCurrency = "EUR" | "USD" | "UAH";
export type CatalogBrochureBranding = "onecompany" | "brand" | "none";
export type CatalogBrochureLayout = "single" | "double";
export type CatalogBrochurePhotoMode = "gallery" | "hero";
export type CatalogBrochureDescriptionMode = "short" | "full" | "none";
export type CatalogBrochureGalleryLayout = "auto" | "feature" | "grid";
export type CatalogBrochurePageTemplate = "editorial" | "gallery" | "technical" | "minimal";
export type CatalogBrochureItemDescriptionMode =
  "inherit" | "short" | "full" | "technical" | "none" | "custom";
export type CatalogBrochureImageFit = "cover" | "contain";

export type CatalogBrochureImageEdit = {
  source: string;
  fit: CatalogBrochureImageFit;
  focusX: number;
  focusY: number;
  zoom: number;
};

export type CatalogBrochureItemInput = {
  productId: string;
  priceOverride?: number | null;
  imageSource?: string | null;
  imageSources?: string[];
  galleryLayout?: CatalogBrochureGalleryLayout;
  pageTemplate?: CatalogBrochurePageTemplate;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  descriptionMode?: CatalogBrochureItemDescriptionMode;
  showSku?: boolean;
  showBrand?: boolean;
  showPrice?: boolean;
  imageEdits?: CatalogBrochureImageEdit[];
};

export type CatalogBrochureRequest = {
  title: string;
  subtitle: string;
  language: CatalogBrochureLanguage;
  currency: CatalogBrochureCurrency;
  layout: CatalogBrochureLayout;
  photoMode?: CatalogBrochurePhotoMode;
  descriptionMode?: CatalogBrochureDescriptionMode;
  branding: CatalogBrochureBranding;
  brandName?: string | null;
  showPrice: boolean;
  clientName?: string | null;
  clientCompany?: string | null;
  managerName?: string | null;
  managerPhone?: string | null;
  managerEmail?: string | null;
  personalNote?: string | null;
  validUntil?: string | null;
  showContactPage?: boolean;
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

export function catalogBrochureContentDisposition(title: string) {
  const safeTitle = title
    .trim()
    .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const utf8FileName = `catalog-${safeTitle || "onecompany"}.pdf`;
  const asciiFileName =
    utf8FileName
      .normalize("NFKD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "catalog-onecompany.pdf";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(utf8FileName)}`;
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
  const imageSource = (entry: unknown) =>
    typeof entry === "string" &&
    entry.trim().length > 0 &&
    entry.length <= 2048 &&
    !/[\u0000-\u001f\u007f]/.test(entry);
  const optionalText = (entry: unknown, max: number) =>
    entry == null || (typeof entry === "string" && entry.length <= max);

  if (!text(body.title, 140)) return "Вкажіть назву каталогу (до 140 символів).";
  if (!text(body.subtitle, 220)) return "Вкажіть підзаголовок каталогу (до 220 символів).";
  if (!["ua", "ru", "en"].includes(String(body.language))) return "Оберіть мову каталогу.";
  if (!["EUR", "USD", "UAH"].includes(String(body.currency))) return "Оберіть валюту каталогу.";
  if (!["single", "double"].includes(String(body.layout))) return "Оберіть розкладку каталогу.";
  if (body.photoMode != null && !["gallery", "hero"].includes(String(body.photoMode))) {
    return "Оберіть режим фотографій каталогу.";
  }
  if (
    body.descriptionMode != null &&
    !["short", "full", "none"].includes(String(body.descriptionMode))
  ) {
    return "Оберіть режим описів каталогу.";
  }
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
  if (!optionalText(body.clientName, 120)) return "Ім’я клієнта задовге.";
  if (!optionalText(body.clientCompany, 160)) return "Назва компанії клієнта задовга.";
  if (!optionalText(body.managerName, 120)) return "Ім’я менеджера задовге.";
  if (!optionalText(body.managerPhone, 80)) return "Телефон менеджера задовгий.";
  if (!optionalText(body.managerEmail, 180)) return "Email менеджера задовгий.";
  if (!optionalText(body.personalNote, 700)) return "Персональне повідомлення задовге.";
  if (body.showContactPage != null && typeof body.showContactPage !== "boolean") {
    return "Некоректне налаштування контактної сторінки.";
  }
  if (body.validUntil != null && body.validUntil !== "") {
    if (typeof body.validUntil !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.validUntil)) {
      return "Некоректна дата дії пропозиції.";
    }
    const validUntil = new Date(`${body.validUntil}T00:00:00.000Z`);
    if (Number.isNaN(validUntil.getTime())) return "Некоректна дата дії пропозиції.";
  }
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
    if (item.imageSource != null && !imageSource(item.imageSource)) {
      return `Перевірте фото товару в позиції ${index + 1}.`;
    }
    if (item.imageSources != null) {
      if (
        !Array.isArray(item.imageSources) ||
        item.imageSources.length < 1 ||
        item.imageSources.length > 8 ||
        item.imageSources.some((source) => !imageSource(source)) ||
        new Set(item.imageSources).size !== item.imageSources.length
      ) {
        return `Оберіть від 1 до 8 унікальних фото товару в позиції ${index + 1}.`;
      }
    }
    if (
      item.galleryLayout != null &&
      !["auto", "feature", "grid"].includes(String(item.galleryLayout))
    ) {
      return `Оберіть розкладку фото товару в позиції ${index + 1}.`;
    }
    if (
      item.pageTemplate != null &&
      !["editorial", "gallery", "technical", "minimal"].includes(String(item.pageTemplate))
    ) {
      return `Оберіть шаблон сторінки товару в позиції ${index + 1}.`;
    }
    if (
      item.descriptionMode != null &&
      !["inherit", "short", "full", "technical", "none", "custom"].includes(
        String(item.descriptionMode)
      )
    ) {
      return `Оберіть режим опису товару в позиції ${index + 1}.`;
    }
    if (!optionalText(item.titleOverride, 180)) {
      return `Назва товару в позиції ${index + 1} задовга.`;
    }
    if (!optionalText(item.descriptionOverride, 1200)) {
      return `Опис товару в позиції ${index + 1} задовгий.`;
    }
    for (const field of ["showSku", "showBrand", "showPrice"] as const) {
      if (item[field] != null && typeof item[field] !== "boolean") {
        return `Перевірте видимість полів товару в позиції ${index + 1}.`;
      }
    }
    if (item.imageEdits != null) {
      if (!Array.isArray(item.imageEdits) || item.imageEdits.length > 8) {
        return `Перевірте кадрування фото товару в позиції ${index + 1}.`;
      }
      for (const edit of item.imageEdits) {
        if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
          return `Перевірте кадрування фото товару в позиції ${index + 1}.`;
        }
        const imageEdit = edit as Record<string, unknown>;
        if (
          !imageSource(imageEdit.source) ||
          !["cover", "contain"].includes(String(imageEdit.fit)) ||
          typeof imageEdit.focusX !== "number" ||
          imageEdit.focusX < 0 ||
          imageEdit.focusX > 100 ||
          typeof imageEdit.focusY !== "number" ||
          imageEdit.focusY < 0 ||
          imageEdit.focusY > 100 ||
          typeof imageEdit.zoom !== "number" ||
          imageEdit.zoom < 1 ||
          imageEdit.zoom > 2
        ) {
          return `Перевірте кадрування фото товару в позиції ${index + 1}.`;
        }
      }
    }
  }
  return null;
}
