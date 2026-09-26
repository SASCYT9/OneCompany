import type { ShopResolvedPricing } from "@/lib/shopPricingAudience";

export const WHEELFORCE_FAMILY_PARENT_TAG = "wheelforce-family-parent";
export const WHEELFORCE_FAMILY_CHILD_TAG = "wheelforce-family-child";
export const WHEELFORCE_WHEEL_SET_SIZE = 4;

export function isWheelForceWheelSet(product: {
  brand?: string | null;
  tags?: readonly string[] | null;
  productType?: string | null;
  sku?: string | null;
  partNumber?: string | null;
  category?: string | { ua?: string | null; en?: string | null } | null;
}) {
  if (product.brand?.trim().toLowerCase() !== "wheelforce") return false;
  const sku = (product.sku ?? product.partNumber)?.trim().toUpperCase() ?? "";
  if (sku.startsWith("WFSET-") || sku.includes("+")) return true;
  // Catalog V2 passes a compact normalized SKU. A WheelForce set SKU is the
  // concatenation of two real axle-specific wheel SKUs, so it remains longer
  // than any single wheel SKU even after its separators are removed.
  if (/^[A-Z0-9]{28,}$/.test(sku)) return true;
  const tags = product.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
  if (tags.includes("wheelforce-wheelset")) return true;
  const type = product.productType?.trim().toLowerCase();
  const categories = typeof product.category === "string"
    ? [product.category]
    : [product.category?.ua, product.category?.en];
  return type === "wheel set" || type === "wheel sets" || categories.some((value) =>
    ["комплекти дисків", "wheel set", "wheel sets"].includes(value?.trim().toLowerCase() ?? "")
  );
}

export function isWheelForceWheel(product: {
  brand?: string | null;
  tags?: readonly string[] | null;
  productType?: string | null;
  sku?: string | null;
  partNumber?: string | null;
  category?: string | { ua?: string | null; en?: string | null } | null;
}) {
  if (product.brand?.trim().toLowerCase() !== "wheelforce") return false;
  if (isWheelForceWheelSet(product)) return false;
  const tags = product.tags?.map((tag) => tag.trim().toLowerCase()) ?? [];
  if (tags.length) return tags.includes("wheels");
  const productType = product.productType?.trim().toLowerCase();
  if (productType === "wheel" || productType === "wheels") return true;
  const categories = typeof product.category === "string"
    ? [product.category]
    : [product.category?.ua, product.category?.en];
  if (categories.some((value) => ["диски", "колісні диски", "wheels", "wheel rims"].includes(value?.trim().toLowerCase() ?? ""))) {
    return true;
  }
  return Boolean((product.sku ?? product.partNumber)?.includes("-"));
}

export function wheelForceSetMoney<T extends { eur: number; usd: number; uah: number }>(price: T): T {
  return {
    ...price,
    eur: price.eur * WHEELFORCE_WHEEL_SET_SIZE,
    usd: price.usd * WHEELFORCE_WHEEL_SET_SIZE,
    uah: price.uah * WHEELFORCE_WHEEL_SET_SIZE,
  };
}

export function wheelForceSetPricing(pricing: ShopResolvedPricing): ShopResolvedPricing {
  return {
    ...pricing,
    effectivePrice: wheelForceSetMoney(pricing.effectivePrice),
    effectiveCompareAt: pricing.effectiveCompareAt
      ? wheelForceSetMoney(pricing.effectiveCompareAt)
      : null,
    bands: {
      b2c: {
        price: wheelForceSetMoney(pricing.bands.b2c.price),
        compareAt: pricing.bands.b2c.compareAt
          ? wheelForceSetMoney(pricing.bands.b2c.compareAt)
          : null,
      },
      b2b: pricing.bands.b2b
        ? {
            ...pricing.bands.b2b,
            price: wheelForceSetMoney(pricing.bands.b2b.price),
            compareAt: pricing.bands.b2b.compareAt
              ? wheelForceSetMoney(pricing.bands.b2b.compareAt)
              : null,
          }
        : null,
    },
  };
}

export function isExactWheelForceSkuSearch(value: string | null | undefined) {
  return Boolean(value && /^[a-z0-9]+-\d{4}-[a-z0-9-]{6,}$/i.test(value.trim()));
}

export type WheelForceFamilyIdentity = {
  key: string;
  model: string;
  finish: string;
  sizeSpec: string;
  titleEn: string;
  titleUa: string;
};

function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseWheelForceFamily(title: string): WheelForceFamilyIdentity | null {
  const parts = title.split("|").map((part) => part.replace(/\s+/g, " ").trim());
  if (parts.length < 3) return null;
  const model = parts[0]
    .replace(/^(?:диск\s+)?(?:wheel\s+)?(?:wheel\s*force|wf)\s*/i, "")
    .trim();
  let sizeSpec = parts[1].replace(/(\d),(\d)/g, "$1.$2");
  const dimensions = sizeSpec.match(/\b(\d{1,2}(?:\.\d+)?)\s*[x×]\s*(\d{1,2}(?:\.\d+)?)/i);
  if (dimensions) {
    const first = Number(dimensions[1]);
    const second = Number(dimensions[2]);
    if (first < 18 && second >= 18) {
      sizeSpec = sizeSpec.replace(dimensions[0], `${dimensions[2]}x${dimensions[1]}`);
    } else {
      sizeSpec = sizeSpec.replace(dimensions[0], `${dimensions[1]}x${dimensions[2]}`);
    }
  }
  sizeSpec = sizeSpec
    .replace(/\b(\d{3})\/5\b/g, "5/$1")
    .replace(/\bET\s*(?=\d{1,2}\s*\/\s*\d{3})/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const finish = parts.slice(2).join(" | ").trim();
  if (!model || !finish || !/\d{1,2}(?:\.\d+)?\s*[x×]\s*\d{1,2}(?:\.\d+)?/i.test(sizeSpec)) {
    return null;
  }
  const key = `${slugPart(model)}--${slugPart(finish)}`;
  if (!key || key === "--") return null;
  return {
    key,
    model,
    finish,
    sizeSpec,
    titleEn: `WheelForce ${model} — ${finish}`,
    titleUa: `Диск WheelForce ${model} — ${finish}`,
  };
}

export function wheelForceFamilyOptionLabel(title: string) {
  return parseWheelForceFamily(title)?.sizeSpec ?? title.trim();
}
