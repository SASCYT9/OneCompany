const URBAN_BRAND = "Urban Automotive";

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Manufacturer/product brand, kept separate from the compatible vehicle make. */
export function resolveShopProductBrand(input: {
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  slug?: string | null;
}) {
  const vendor = normalize(input.vendor);
  const tags = input.tags ?? [];
  const isUrban =
    vendor === "urban" ||
    vendor === "urban automotive" ||
    tags.some((tag) => normalize(tag) === "urban-manufacturer:urban-automotive") ||
    normalize(input.slug).startsWith("urb-");

  if (isUrban) return URBAN_BRAND;
  return String(input.brand ?? input.vendor ?? "").trim();
}

export const SHOP_URBAN_PRODUCT_BRAND = URBAN_BRAND;
