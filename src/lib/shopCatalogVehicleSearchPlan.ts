/** Keep vehicle and powertrain/emissions constraints in one canonical clause. */
import { canonicalizeShopSearchQuery, isShopVehicleSearchToken } from "@/lib/shopSearch";
import { expandVehicleAliases } from "@/lib/shopVehicleSearch";
import { vehicleMakesMentionedInQuery } from "@/lib/shopVehicleTaxonomy";

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
  const query = canonicalizeShopSearchQuery(params.get("q") ?? "");
  const queryExpansion = query ? expandVehicleAliases(query) : null;
  const queryMakes = query ? vehicleMakesMentionedInQuery(query) : [];
  const isChassisToken = (token: string) =>
    /^(?:[efg]\d{2,3}[a-z]?|[wcl]\d{3}[a-z]?|r\d{2,3}[a-z]?|mk\d(?:\.\d)?|mqb|[89]\d{2}(?:\.\d)?|718)$/i.test(
      token
    );
  const queryChassis = queryExpansion
    ? queryExpansion.chassis.length
      ? queryExpansion.chassis
      : queryExpansion.tokens.filter(
          (token) => isShopVehicleSearchToken(token) && isChassisToken(token)
        )
    : [];
  // Search-box vehicle queries do not populate selector URL params. Infer a
  // constraint only when the alias dictionary gives one unambiguous make plus
  // one model or chassis; broad families such as `G8X` must stay lexical.
  const hasSpecificQueryIdentity = Boolean(
    queryExpansion &&
    queryMakes.length === 1 &&
    (queryExpansion.models.length === 1 || queryChassis.length === 1)
  );
  const inferredMake = hasSpecificQueryIdentity ? (queryMakes[0] ?? null) : null;
  const inferredModel =
    hasSpecificQueryIdentity && queryExpansion?.models.length === 1
      ? queryExpansion.models[0]
      : null;
  const inferredGeneration =
    hasSpecificQueryIdentity && queryChassis.length === 1 ? queryChassis[0].toUpperCase() : null;
  const inferredYear =
    hasSpecificQueryIdentity && queryExpansion?.years.length === 1 ? queryExpansion.years[0] : null;
  const yearText = params.get("year")?.trim() ?? "";
  const parsedYear = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const constraints = {
    make: clean(params.get("make")) ?? inferredMake,
    model: clean(params.get("model")) ?? inferredModel,
    generation: clean(params.get("chassis") ?? params.get("generation")) ?? inferredGeneration,
    year:
      parsedYear != null && parsedYear >= 1886 && parsedYear <= 2200 ? parsedYear : inferredYear,
    // Do not infer an engine from a model/platform alias (for example M3 G80
    // happens to carry S58 in the alias dictionary). Engine is a user-selected
    // hard constraint; inferring it here would switch legacy searches to the
    // still-partial native projection and hide valid historical products.
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
