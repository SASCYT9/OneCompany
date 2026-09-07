export function canUsePremiumCatalogProjection(params: URLSearchParams) {
  const productType = params.get("productType")?.trim();
  const productKind = params.get("productKind")?.trim().toLowerCase();
  const strict = params.get("strict")?.trim() === "1";
  const brands = params
    .getAll("brand")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return (
    !productType && (!productKind || productKind === "any") && !strict && new Set(brands).size <= 1
  );
}
