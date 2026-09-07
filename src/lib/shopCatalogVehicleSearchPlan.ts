/** Keep vehicle and powertrain/emissions constraints in one canonical clause. */
export function buildShopCatalogVehicleSearchPlan(
  params: URLSearchParams,
  input: { readerMode?: string } = {}
) {
  const clean = (value: string | null) => {
    const text = value?.trim() ?? "";
    return text && text.length <= 320 ? text : null;
  };
  const parseOpfGpf = (value: string | null) => {
    const raw = value?.trim() ?? "";
    if (!raw) return null;
    if (raw.length > 320) throw new TypeError("opfGpf exceeds 320 characters");
    const normalized = raw.toLowerCase();
    if (normalized !== "with" && normalized !== "without") {
      throw new TypeError("opfGpf must be with or without");
    }
    return normalized;
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
    opfGpf: parseOpfGpf(params.get("opfGpf")),
  };
  // The legacy bridge has no engine, fuel, or OPF/GPF evidence. Combining its
  // IDs with any of those selections could match fields from different clauses.
  const reader = input.readerMode?.trim().toLowerCase() === "projection" ? "projection" : "legacy";
  const canonical =
    reader === "projection" ||
    Boolean(constraints.engine || constraints.fuel || constraints.opfGpf);
  return { constraints, canonical, reader };
}
