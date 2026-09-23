/** Keep vehicle and powertrain/emissions constraints in one canonical clause. */
import { canonicalizeShopSearchQuery, isShopVehicleSearchToken } from "@/lib/shopSearch";
import { expandVehicleAliases } from "@/lib/shopVehicleSearch";
import {
  canonicalVehicleMakeLabel,
  resolveVehicleModelFilter,
  vehicleModelKey,
  vehicleMakesMentionedInQuery,
} from "@/lib/shopVehicleTaxonomy";

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
  const queryMakes = query
    ? [...new Set([
        ...vehicleMakesMentionedInQuery(query),
        ...(queryExpansion?.makes ?? []),
      ].map(canonicalVehicleMakeLabel))]
    : [];
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
  const queryWithBoundaries = ` ${query} `;
  const explicitlyMentionedModels = (queryExpansion?.models ?? []).filter((candidate) => {
    const normalizedModel = canonicalizeShopSearchQuery(candidate);
    return normalizedModel.length > 0 && queryWithBoundaries.includes(` ${normalizedModel} `);
  });
  // Search-box vehicle queries do not populate selector URL params. Infer a
  // constraint only when the alias dictionary gives one unambiguous make plus
  // one model or chassis; additional product words remain text search terms.
  const hasSpecificQueryIdentity = Boolean(
    queryExpansion &&
    queryMakes.length === 1 &&
    (explicitlyMentionedModels.length === 1 ||
      queryExpansion.models.length === 1 ||
      queryChassis.length === 1)
  );
  const inferredMake = hasSpecificQueryIdentity ? (queryMakes[0] ?? null) : null;
  const inferredModel =
    hasSpecificQueryIdentity && explicitlyMentionedModels.length === 1
      ? explicitlyMentionedModels[0]
      : hasSpecificQueryIdentity && queryExpansion?.models.length === 1
        ? queryExpansion.models[0]
        : null;
  const inferredGeneration =
    hasSpecificQueryIdentity && queryChassis.length === 1 ? queryChassis[0].toUpperCase() : null;
  const inferredYear =
    hasSpecificQueryIdentity && queryExpansion?.years.length === 1 ? queryExpansion.years[0] : null;
  const make = clean(params.get("make")) ?? inferredMake;
  const requestedModel = clean(params.get("model")) ?? inferredModel;
  const modelFilter = make && requestedModel ? resolveVehicleModelFilter(make, requestedModel) : null;
  const requestedGeneration = clean(params.get("chassis") ?? params.get("generation")) ?? inferredGeneration;
  // KW's Audi catalog labels the RS5 (B9) application under A5 type B8/F53.
  // Keep the RS5 qualifier and translate only that explicitly selected pair.
  const generation =
    make?.toLowerCase().replace(/[^a-z]/g, "") === "audi" &&
    requestedModel && vehicleModelKey(requestedModel) === "rs5" &&
    requestedGeneration?.toUpperCase() === "B9"
      ? "B8"
      : requestedGeneration;
  const yearText = params.get("year")?.trim() ?? "";
  const parsedYear = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  const constraints = {
    make,
    model: modelFilter?.model ?? requestedModel,
    generation,
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
  return {
    constraints,
    qualifierTerms: modelFilter?.qualifierTerms ?? [],
    canonical,
    reader,
  };
}
