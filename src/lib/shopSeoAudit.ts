export type ShopSeoAuditProduct = {
  slug: string;
  sku: string | null;
  brand: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isPublished: boolean;
  titleUa: string;
  titleEn: string;
  categoryUa: string | null;
  categoryEn: string | null;
  shortDescUa: string | null;
  shortDescEn: string | null;
  longDescUa: string | null;
  longDescEn: string | null;
  bodyHtmlUa: string | null;
  bodyHtmlEn: string | null;
  image: string | null;
  priceEur: unknown;
  priceEurEurope: unknown;
  priceUsd: unknown;
  priceUah: unknown;
  pricedVariants: Array<{ id: string }>;
};

export type ShopSeoIssue =
  | "not-active"
  | "not-published"
  | "missing-title-ua"
  | "missing-title-en"
  | "missing-description-ua"
  | "missing-description-en"
  | "missing-category-ua"
  | "missing-category-en"
  | "missing-image"
  | "missing-price"
  | "missing-sku";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasPositivePrice(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

export function assessShopProductSeo(product: ShopSeoAuditProduct): ShopSeoIssue[] {
  const issues: ShopSeoIssue[] = [];

  if (product.status !== "ACTIVE") issues.push("not-active");
  if (!product.isPublished) issues.push("not-published");
  if (!hasText(product.titleUa)) issues.push("missing-title-ua");
  if (!hasText(product.titleEn)) issues.push("missing-title-en");
  if (
    !hasText(product.shortDescUa) &&
    !hasText(product.longDescUa) &&
    !hasText(product.bodyHtmlUa)
  ) {
    issues.push("missing-description-ua");
  }
  if (
    !hasText(product.shortDescEn) &&
    !hasText(product.longDescEn) &&
    !hasText(product.bodyHtmlEn)
  ) {
    issues.push("missing-description-en");
  }
  if (!hasText(product.categoryUa)) issues.push("missing-category-ua");
  if (!hasText(product.categoryEn)) issues.push("missing-category-en");
  if (!hasText(product.image)) issues.push("missing-image");

  const hasProductPrice = [
    product.priceEur,
    product.priceEurEurope,
    product.priceUsd,
    product.priceUah,
  ].some(hasPositivePrice);
  if (!hasProductPrice && product.pricedVariants.length === 0) issues.push("missing-price");
  if (!hasText(product.sku)) issues.push("missing-sku");

  return issues;
}

export function isPublishedActiveSitemapCandidate(product: ShopSeoAuditProduct): boolean {
  return product.isPublished && product.status === "ACTIVE";
}

export function normalizeSeoTitleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, " ")
    .trim();
}
