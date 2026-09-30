/** Keep vehicle and powertrain/emissions constraints in one canonical clause. */
import { canonicalizeShopSearchQuery, isShopVehicleSearchToken } from "@/lib/shopSearch";
import { expandVehicleAliases } from "@/lib/shopVehicleSearch";
import {
  canonicalVehicleMakeLabel,
  resolveVehicleModelFilter,
  vehicleModelKey,
  vehicleMakesMentionedInQuery,
  vehicleMakeAliases,
  vehicleModelAliases,
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
    ? [
        ...new Set(
          [...vehicleMakesMentionedInQuery(query), ...(queryExpansion?.makes ?? [])].map(
            canonicalVehicleMakeLabel
          )
        ),
      ]
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
      // Multiple explicit trim/model codes in a pasted product name describe
      // several applications, not one vehicle selected by the customer.
      explicitlyMentionedModels.length <= 1 &&
      query
        .split(" ")
        .filter((token) => /^(?:g[345678]\d{2}[a-z]?|m[234568]|rs[2345678])$/.test(token)).length <=
        1 &&
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
  const modelFilter =
    make && requestedModel ? resolveVehicleModelFilter(make, requestedModel) : null;
  // Preserve a specific selector identity when its broad family is used for
  // the catalog constraint (for example AMG G 63 -> G-Class). The qualifier
  // term keeps free-text matching specific to the selected model.
  const modelAlternates =
    modelFilter &&
    requestedModel &&
    vehicleModelKey(modelFilter.model) !== vehicleModelKey(requestedModel)
      ? [requestedModel]
      : [];
  const requestedGeneration =
    clean(params.get("chassis") ?? params.get("generation")) ?? inferredGeneration;
  // Supplier-specific type codes must be normalized during ingestion. A KW
  // alias must never rewrite the customer's generation for every other brand.
  const generation = requestedGeneration;
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
  // Compatibility has already bound these identities. Requiring their words
  // again in a product title/index hides valid multi-application products.
  // Consume only identities resolved by this plan; engine/trim/product words
  // remain lexical, and conflicting explicit selector values consume nothing.
  const queryIdentityMatchesSelection = Boolean(
    hasSpecificQueryIdentity &&
      inferredMake &&
      canonicalVehicleMakeLabel(make ?? "") === canonicalVehicleMakeLabel(inferredMake) &&
      (!inferredModel ||
        vehicleModelKey(resolveVehicleModelFilter(inferredMake, inferredModel).model) ===
          vehicleModelKey(constraints.model ?? "")) &&
      (!inferredGeneration || inferredGeneration.toUpperCase() === generation?.toUpperCase()) &&
      (inferredYear == null || constraints.year === inferredYear)
  );
  const consumedTokens = new Set(
    queryIdentityMatchesSelection
      ? [
          ...vehicleMakeAliases(inferredMake!),
          ...(inferredModel ? vehicleModelAliases(inferredMake!, inferredModel) : []),
          ...(inferredGeneration ? [inferredGeneration] : []),
          ...(inferredYear != null ? [String(inferredYear)] : []),
        ].flatMap((value) => canonicalizeShopSearchQuery(value).split(" "))
      : []
  );
  const resolvedModelTokens = new Set(
    inferredModel && inferredMake
      ? vehicleModelAliases(inferredMake, inferredModel).map(canonicalizeShopSearchQuery)
      : []
  );
  const explicitSoftTerms = queryIdentityMatchesSelection
    ? (queryExpansion?.softTerms ?? []).filter((term) => {
        const normalized = canonicalizeShopSearchQuery(term);
        return (
          queryWithBoundaries.includes(` ${normalized} `) && !resolvedModelTokens.has(normalized)
        );
      })
    : [];
  const textTerms = [
    ...query.split(" ").filter((token) => token && !consumedTokens.has(token)),
    ...(modelFilter?.qualifierTerms ?? []),
    ...explicitSoftTerms,
  ];
  const textQuery = [
    ...new Map(textTerms.map((term) => [canonicalizeShopSearchQuery(term), term])).values(),
  ].join(" ");
  return {
    constraints,
    textQuery,
    qualifierTerms: modelFilter?.qualifierTerms ?? [],
    modelAlternates,
    canonical,
    reader,
  };
}
