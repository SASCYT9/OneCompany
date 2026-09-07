/** Preserve one correlated vehicle query when engine/fuel need canonical evidence. */
export function buildShopCatalogVehicleSearchPlan(
  params: URLSearchParams,
  input: { readerMode?: string } = {}
) {
  const clean = (value: string | null) => {
    const text = value?.trim() ?? "";
    return text && text.length <= 320 ? text : null;
  };
  const yearText = params.get("year")?.trim() ?? "";
  const parsedYear = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const constraints = {
    make: clean(params.get("make")),
    model: clean(params.get("model")),
    generation: clean(params.get("chassis") ?? params.get("generation")),
    year: parsedYear != null && parsedYear >= 1886 && parsedYear <= 2200 ? parsedYear : null,
    engine: clean(params.get("engine")),
    fuel: clean(params.get("fuel")),
  };
  // The legacy bridge has no engine or fuel evidence. Combining its IDs with
  // an engine-only query would allow fields from different clauses to match.
  const reader = input.readerMode?.trim().toLowerCase() === "projection" ? "projection" : "legacy";
  const canonical = reader === "projection" || Boolean(constraints.engine || constraints.fuel);
  return { constraints, canonical, reader };
}
