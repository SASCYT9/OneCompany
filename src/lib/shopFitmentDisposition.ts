import type { Fitment } from "@/lib/crossShopFitment";
import type { ShopProduct } from "@/lib/shopCatalog";

export type AutomaticFitmentDisposition =
  | { mode: "direct" }
  | { mode: "universal"; reason: string }
  | { mode: "parent_dependent"; parentSku: string | null; reason: string };

function evidence(product: ShopProduct) {
  return [
    product.title?.en,
    product.title?.ua,
    product.category?.en,
    product.category?.ua,
    product.productType,
    product.slug,
    product.sku,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" | ");
}

function giroDiscParentSku(product: ShopProduct): string | null {
  const sku = String(product.sku ?? "")
    .trim()
    .toUpperCase();
  const match = sku.match(/^D([12])[-_]?(.+)$/);
  return match ? `A${match[1]}-${match[2]}` : null;
}

export function classifyAutomaticFitmentDisposition(
  product: ShopProduct,
  fitment: Fitment
): AutomaticFitmentDisposition {
  const brand = String(product.brand ?? "")
    .trim()
    .toLowerCase();
  const value = evidence(product);

  if (
    brand.includes("girodisc") &&
    (/\breplacement\s+(?:rotor\s+)?rings?\b/i.test(value) || /^D[12][-_]/i.test(product.sku))
  ) {
    return {
      mode: "parent_dependent",
      parentSku: giroDiscParentSku(product),
      reason: "GiroDisc replacement ring inherits compatibility from its parent rotor kit",
    };
  }

  if (
    brand.includes("do88") &&
    !fitment.make &&
    /\b(?:silicone\s+)?(?:hose|coupler|reducer|elbow|joiner|adapter|clamp)(?:s)?\b/i.test(value) &&
    /\b(?:mm|inch|degree|degrees|\d+(?:\.\d+)?\s*(?:mm|cm|in))\b/i.test(value)
  ) {
    return {
      mode: "universal",
      reason: "Dimensional DO88 plumbing component has no vehicle-specific application",
    };
  }

  if (
    (brand.includes("ohlins") || brand.includes("öhlins")) &&
    !fitment.make &&
    /\b(?:replacement|service|spare|spring seat|mounting hardware|adjuster|bushing)\b/i.test(value)
  ) {
    return {
      mode: "parent_dependent",
      parentSku: null,
      reason:
        "Öhlins service component requires a parent kit before vehicle compatibility is known",
    };
  }

  return { mode: "direct" };
}
