import "server-only";

import { extractProductFitment, getExpectedChassisForMakeModel } from "@/lib/crossShopFitment";
import { getShopFitmentCatalogProducts } from "@/lib/shopFitmentCatalogServer";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import {
  vehicleChassisKey,
  vehicleChassisMatchLevel,
  vehicleChassisSelfAndAncestors,
  vehicleModelScope,
} from "@/lib/shopVehicleHierarchy";
import {
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
} from "@/lib/shopImportFitment";
import { parseNormalizedFitment, resolveSearchFitments } from "@/lib/shopFitmentQuality";
import { prisma } from "@/lib/prisma";
import { Prisma, ShopCatalogCompatibilityDimension } from "@prisma/client";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import {
  canonicalizeVehicleChassisCodes,
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

type LegacyVehicleQuery = {
  brand?: string | null;
  make?: string | null;
  model?: string | null;
  modelAlternates?: readonly string[] | null;
  generation?: string | null;
  year?: number | null;
};

export type LegacyVehicleTiers = { ids: string[]; exactIds: string[] };

const CACHE_MS = 5 * 60_000;

// Resolving the legacy bridge requires two potentially large relation scans.
// Keep the final answer by normalized vehicle query as well, so repeated
// requests do not repeat those scans while the fitment catalog is warm.
const RESOLUTION_CACHE_MS = 60_000;
const RESOLUTION_CACHE_MAX_ENTRIES = 256;

type CachedFitmentProducts = Array<{
  id: string | undefined;
  fitments: ReturnType<typeof resolveSearchFitments>;
}>;
type VehicleApplication = {
  productId: string;
  model: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};
type ProjectionConstraint = {
  dimension: string;
  state: string;
  textValue: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};
type ProjectionClause = { productId: string; constraints: ProjectionConstraint[] };
type VehicleEvidence = { applications: VehicleApplication[]; clauses: ProjectionClause[] };
type LegacyVehicleCacheState = {
  cachedProducts: CachedFitmentProducts | null;
  cachedAt: number;
  fitmentPending?: Promise<CachedFitmentProducts>;
  resolvedVehicleIds: Map<string, { ids: string[]; exactIds: string[]; expiresAt: number }>;
  pendingVehicleResolutions: Map<string, Promise<LegacyVehicleTiers>>;
  evidence: Map<string, { value: VehicleEvidence; expiresAt: number }>;
  pendingEvidence: Map<string, Promise<VehicleEvidence>>;
};
const globalCache = globalThis as typeof globalThis & {
  __oneCompanyLegacyVehicleCacheV2?: LegacyVehicleCacheState;
};
const sharedCache: LegacyVehicleCacheState = (globalCache.__oneCompanyLegacyVehicleCacheV2 ??= {
  cachedProducts: null,
  cachedAt: 0,
  resolvedVehicleIds: new Map(),
  pendingVehicleResolutions: new Map(),
  evidence: new Map(),
  pendingEvidence: new Map(),
});

type RequestedModelScope = { exact: string[]; broad: string[] };

function dedupeModelLabels(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = vehicleModelKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Selected model(s) with their trims (exact) and families (broad). */
function requestedModelScope(
  canonicalMake: string,
  input: LegacyVehicleQuery
): RequestedModelScope {
  const requested = [input.model, ...(input.modelAlternates ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const scopes = requested.map((value) => vehicleModelScope(canonicalMake, value));
  return {
    exact: dedupeModelLabels(scopes.flatMap((scope) => scope.exact)),
    broad: dedupeModelLabels(scopes.flatMap((scope) => scope.broad)),
  };
}

function modelKeySet(canonicalMake: string, labels: readonly string[]) {
  return new Set(
    [...new Set(labels.flatMap((value) => vehicleModelAliases(canonicalMake, value)))].flatMap(
      (value) => [
        vehicleModelKey(value),
        vehicleModelKey(canonicalVehicleModelLabel(canonicalMake, value)),
      ]
    )
  );
}

/** The requested generation and its ancestors (`992.1` -> `992.1`, `992`). */
function generationLineage(generation: string | null | undefined) {
  const value = generation?.trim();
  return value ? [...new Set([value, ...vehicleChassisSelfAndAncestors(value)])] : [];
}

function vehicleQueryCacheKey(input: LegacyVehicleQuery) {
  return JSON.stringify([
    normalizeShopSearchText(input.brand),
    canonicalVehicleMakeLabel(input.make ?? ""),
    input.model ? vehicleModelKey(input.model) : "",
    [...new Set((input.modelAlternates ?? []).map(vehicleModelKey))].sort(),
    vehicleChassisKey(input.generation),
    input.year ?? null,
  ]);
}

function cacheResolvedVehicleIds(key: string, tiers: LegacyVehicleTiers) {
  sharedCache.resolvedVehicleIds.delete(key);
  sharedCache.resolvedVehicleIds.set(key, {
    ids: tiers.ids,
    exactIds: tiers.exactIds,
    expiresAt: Date.now() + RESOLUTION_CACHE_MS,
  });
  while (sharedCache.resolvedVehicleIds.size > RESOLUTION_CACHE_MAX_ENTRIES) {
    const oldestKey = sharedCache.resolvedVehicleIds.keys().next().value;
    if (oldestKey === undefined) break;
    sharedCache.resolvedVehicleIds.delete(oldestKey);
  }
}

function cacheVehicleEvidence(key: string, value: VehicleEvidence) {
  sharedCache.evidence.delete(key);
  sharedCache.evidence.set(key, { value, expiresAt: Date.now() + RESOLUTION_CACHE_MS });
  while (sharedCache.evidence.size > 16) {
    const oldestKey = sharedCache.evidence.keys().next().value;
    if (oldestKey === undefined) break;
    sharedCache.evidence.delete(oldestKey);
  }
}

async function getCachedFitmentProducts(productIds?: readonly string[] | null) {
  if (productIds) {
    if (productIds.length === 0) return [];
    const products = await getShopFitmentCatalogProducts({
      evidenceOnly: true,
      productIds,
    });
    return indexFitmentProducts(products);
  }
  if (sharedCache.cachedProducts && Date.now() - sharedCache.cachedAt < CACHE_MS) {
    return sharedCache.cachedProducts;
  }
  if (sharedCache.fitmentPending) return sharedCache.fitmentPending;
  sharedCache.fitmentPending = getShopFitmentCatalogProducts({ evidenceOnly: true })
    .then(async (products) => {
      sharedCache.cachedProducts = await indexFitmentProducts(products);
      sharedCache.cachedAt = Date.now();
      return sharedCache.cachedProducts;
    })
    .finally(() => {
      sharedCache.fitmentPending = undefined;
    });
  return sharedCache.fitmentPending;
}

const METAFIELD_BATCH_SIZE = 100;
const METAFIELD_PARALLEL_BATCHES = 4;

function chunk<T>(values: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function indexFitmentProducts(
  products: Awaited<ReturnType<typeof getShopFitmentCatalogProducts>>
) {
  const productIds = products
    .filter((product) => ["wheelforce", "bmc"].includes(normalizeShopSearchText(product.brand)))
    .map((product) => product.id)
    .filter((id): id is string => Boolean(id));
  // Supplier contracts are large; read them in bounded batches so one wide
  // vehicle selection never exceeds a single-response size limit.
  const metafields: Array<{ productId: string; key: string; value: string }> = [];
  const batches = chunk(productIds, METAFIELD_BATCH_SIZE);
  for (let start = 0; start < batches.length; start += METAFIELD_PARALLEL_BATCHES) {
    const group = await Promise.all(
      batches.slice(start, start + METAFIELD_PARALLEL_BATCHES).map((ids) =>
        prisma.shopProductMetafield.findMany({
          where: {
            productId: { in: ids },
            namespace: "onecompany",
            key: { in: ["normalized_fitment", SUPPLIER_FITMENT_KEY] },
          },
          select: { productId: true, key: true, value: true },
        })
      )
    );
    metafields.push(...group.flat());
  }
  const byProduct = new Map<string, { normalized?: string; supplier?: string }>();
  for (const item of metafields) {
    const current = byProduct.get(item.productId) ?? {};
    if (item.key === "normalized_fitment") current.normalized = item.value;
    if (item.key === SUPPLIER_FITMENT_KEY) current.supplier = item.value;
    byProduct.set(item.productId, current);
  }
  return products.map((product) => {
    const automatic = extractProductFitment(product);
    const persisted = byProduct.get(product.id ?? "");
    const supplier = parseSupplierFitmentContract(persisted?.supplier);
    const manualFitment = parseNormalizedFitment(persisted?.normalized);
    const preserveManualFitment =
      manualFitment?.source === "manual" && manualFitment.status === "verified";
    const value = preserveManualFitment
      ? persisted?.normalized
      : supplier
        ? JSON.stringify(supplierContractToNormalizedFitment(supplier))
        : (persisted?.normalized ?? null);
    return {
      id: product.id,
      fitments: resolveSearchFitments(automatic, value),
    };
  });
}

type ProductTextField = "titleEn" | "titleUa" | "slug" | "collectionEn" | "collectionUa";

function productTextAlternatives(fields: readonly ProductTextField[], values: readonly string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) =>
      fields.map((field) => ({ [field]: { contains: value, mode: "insensitive" } }))
    );
}

/**
 * Tag keys a value was persisted under: the historical lower-case/hyphen form
 * and the importer slug (`scripts/_lib/backfillFitsTags.ts`), which strips
 * diacritics and punctuation (`Volkswagen (Svw)` -> `volkswagen-svw`).
 */
function legacyTagKeys(value: string) {
  const historical = value.toLowerCase().replace(/[-_]+/g, " ").trim().replace(/\s+/g, "-");
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [...new Set([historical, slug].filter(Boolean))];
}

/**
 * Keep the legacy bridge broad enough for historical feeds, but bound the
 * product read to rows that can actually mention the selected vehicle. The
 * previous implementation loaded and parsed the entire active catalog before
 * checking the vehicle, which made a cold filter request several seconds.
 *
 * Candidates only need to be a superset of the real matches (the exact
 * fitment check runs afterwards), so every spelling of the selection counts:
 * all trims of a model family and the selected generation with its ancestors.
 */
async function findLegacyFitmentCandidateIds(
  input: LegacyVehicleQuery,
  canonicalMake: string,
  scope: RequestedModelScope
) {
  const makeValues = [
    ...new Set([canonicalMake, ...(input.make ? vehicleMakeAliases(canonicalMake) : [])]),
  ];
  // Importers wrote tags from their own spelling (`fits-make:skoda` for
  // `Škoda`, `fits-make:volkswagen-svw`): build tags from every alias.
  const makeKeys = [...new Set(makeValues.flatMap(legacyTagKeys))];
  const makeTags = makeKeys.map((makeKey) => `fits-make:${makeKey}`);
  const modelValues = [
    ...new Set(scope.broad.flatMap((value) => vehicleModelAliases(canonicalMake, value))),
  ];
  const generationValues = generationLineage(input.generation);
  const tagValues = new Set<string>();
  const modelTagValues = new Set<string>();
  const generationTagValues = new Set<string>();

  // A bare fits-make tag is intentionally broad. Use it only for a make-only
  // selection; model/generation selections get focused tags plus text joins.
  if (input.make && !input.model && !input.generation) {
    for (const makeTag of makeTags) tagValues.add(makeTag);
  }
  const modelKeys = [...new Set(modelValues.flatMap(legacyTagKeys))];
  for (const modelKey of modelKeys) {
    if (input.make) {
      for (const makeKey of makeKeys) {
        modelTagValues.add(`fits-model:${makeKey}:${modelKey}`);
        modelTagValues.add(`fits:${makeKey}-${modelKey}`);
      }
    }
    modelTagValues.add(`model:${modelKey}`);
  }
  for (const generation of generationValues) {
    const generationKey = generation.trim().toLowerCase();
    generationTagValues.add(`chassis:${generationKey}`);
    generationTagValues.add(`chassis:${generation.trim().toUpperCase()}`);
    for (const modelKey of modelKeys) {
      if (input.make) {
        for (const makeKey of makeKeys) {
          generationTagValues.add(`fits-trim:${makeKey}:${modelKey}:${generationKey}`);
        }
      }
    }
  }
  for (const tag of [...modelTagValues, ...generationTagValues]) tagValues.add(tag);

  const textFields: ProductTextField[] = [
    "titleEn",
    "titleUa",
    "slug",
    "collectionEn",
    "collectionUa",
  ];
  const makeText = productTextAlternatives(textFields, makeValues);
  const modelText = productTextAlternatives(textFields, modelValues);
  const generationText = productTextAlternatives(textFields, generationValues);
  const alternatives: Record<string, unknown>[] = [];
  // A valid make tag can pair with a model in the product title even when an
  // old importer produced an incomplete model tag (notably Urban Defender).
  if (input.make && modelText.length > 0) {
    alternatives.push({ AND: [{ tags: { hasSome: makeTags } }, { OR: modelText }] });
  }
  if (tagValues.size > 0) alternatives.push({ tags: { hasSome: [...tagValues] } });
  if (input.make && (input.model || input.generation)) {
    const focusedTags = [...modelTagValues, ...generationTagValues];
    if (focusedTags.length > 0) {
      alternatives.push({
        AND: [{ tags: { hasSome: makeTags } }, { tags: { hasSome: focusedTags } }],
      });
    }
  }
  if (makeText.length > 0 && modelText.length > 0 && generationText.length > 0) {
    alternatives.push({ AND: [{ OR: makeText }, { OR: modelText }, { OR: generationText }] });
  }
  if (makeText.length > 0 && modelText.length > 0) {
    alternatives.push({ AND: [{ OR: makeText }, { OR: modelText }] });
  }
  if (makeText.length > 0 && generationText.length > 0) {
    alternatives.push({ AND: [{ OR: makeText }, { OR: generationText }] });
  }
  // Suppliers often write only the platform (`PORSCHE 992 GT3`), never the
  // model label the picker offers (`911 GT3`): the model's own generations
  // pair with the make as well.
  if (input.model && makeText.length > 0) {
    const expectedChassis = [
      ...new Set(
        scope.broad.flatMap((value) => getExpectedChassisForMakeModel(canonicalMake, value) ?? [])
      ),
    ];
    const expectedText = productTextAlternatives(textFields, expectedChassis);
    if (expectedText.length > 0) {
      alternatives.push({ AND: [{ OR: makeText }, { OR: expectedText }] });
    }
  }
  // Choosing only a make must not hide products that name the make in the
  // title but carry no fitment tag.
  if (input.make && !input.model && !input.generation && makeText.length > 0) {
    alternatives.push({ OR: makeText });
  }
  if (alternatives.length === 0) return null;

  const rows = await prisma.shopProduct.findMany({
    where: {
      isPublished: true,
      status: "ACTIVE",
      OR: alternatives,
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

type StringMatchFilter =
  | { equals: string; mode: "insensitive" }
  | { startsWith: string; mode: "insensitive" };

/**
 * Stored chassis codes that satisfy a request: the code itself, its ancestors
 * (lower tier) and its facelifts (`992` -> `992.1`, `G20` -> `G20 LCI`). The
 * exact lineage rule is applied again in memory.
 */
function generationStringFilters(generation: string): StringMatchFilter[] {
  return generationLineage(generation).flatMap((value) => [
    { equals: value, mode: "insensitive" as const },
    { startsWith: `${value}.`, mode: "insensitive" as const },
    { startsWith: `${value} `, mode: "insensitive" as const },
  ]);
}

async function getCachedVehicleEvidence(
  canonicalMake: string,
  makeAliases: string[],
  year?: number | null,
  scope?: RequestedModelScope,
  generation?: string | null
) {
  const requestedModels = scope?.broad ?? [];
  const modelAliases = [
    ...new Set(requestedModels.flatMap((value) => vehicleModelAliases(canonicalMake, value))),
  ];
  const generationValue = generation?.trim() || null;
  const key = JSON.stringify([
    canonicalMake,
    [...new Set(requestedModels.map(vehicleModelKey))].sort(),
    generationValue ? vehicleChassisKey(generationValue) : null,
    year ?? null,
  ]);
  const cached = sharedCache.evidence.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    sharedCache.evidence.delete(key);
    sharedCache.evidence.set(key, cached);
    return cached.value;
  }
  if (cached) sharedCache.evidence.delete(key);
  const pending = sharedCache.pendingEvidence.get(key);
  if (pending) return pending;
  const generationFilters = generationValue ? generationStringFilters(generationValue) : [];
  const clauseAnd: Prisma.ShopCatalogProjectionClauseWhereInput[] = [
    ...(year
      ? [
          {
            constraints: {
              some: {
                dimension: "YEAR" as const,
                state: "EXACT" as const,
                AND: [
                  { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
                  { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
                ],
              },
            },
          },
        ]
      : []),
    ...(modelAliases.length
      ? [
          {
            constraints: {
              some: {
                dimension: "MODEL" as const,
                state: "EXACT" as const,
                textValue: { in: modelAliases, mode: "insensitive" as const },
              },
            },
          },
        ]
      : []),
    ...(generationFilters.length
      ? [
          {
            constraints: {
              some: {
                dimension: {
                  in: [
                    ShopCatalogCompatibilityDimension.GENERATION,
                    ShopCatalogCompatibilityDimension.CHASSIS,
                  ],
                },
                state: "EXACT" as const,
                OR: generationFilters.map((filter) => ({ textValue: filter })),
              },
            },
          },
        ]
      : []),
  ];
  const applicationAnd: Prisma.ShopVehicleApplicationWhereInput[] = year
    ? [
        { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
        { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
      ]
    : [];
  const promise = Promise.all([
    prisma.shopVehicleApplication.findMany({
      where: {
        isActive: true,
        isUniversal: false,
        verificationStatus: "VERIFIED",
        make: { in: makeAliases, mode: "insensitive" },
        ...(applicationAnd.length ? { AND: applicationAnd } : {}),
        ...(generationFilters.length
          ? { OR: generationFilters.map((filter) => ({ chassisCode: filter })) }
          : {}),
        ...(modelAliases.length ? { model: { in: modelAliases, mode: "insensitive" } } : {}),
        product: { isPublished: true, status: "ACTIVE" },
      },
      select: { productId: true, model: true, chassisCode: true, yearFrom: true, yearTo: true },
    }),
    prisma.shopCatalogProjectionClause.findMany({
      where: {
        policy: { mode: "VEHICLE_SPECIFIC" },
        verification: "VERIFIED",
        product: { isPublished: true, status: "ACTIVE" },
        constraints: {
          some: {
            dimension: "MAKE",
            state: "EXACT",
            textValue: { in: makeAliases, mode: "insensitive" },
          },
        },
        ...(clauseAnd.length ? { AND: clauseAnd } : {}),
      },
      select: {
        productId: true,
        constraints: {
          select: { dimension: true, state: true, textValue: true, yearFrom: true, yearTo: true },
        },
      },
    }),
  ])
    .then(([applications, clauses]) => {
      const value = { applications, clauses } as VehicleEvidence;
      cacheVehicleEvidence(key, value);
      return value;
    })
    .finally(() => {
      sharedCache.pendingEvidence.delete(key);
    });
  sharedCache.pendingEvidence.set(key, promise);
  return promise;
}

type MatchTier = 0 | 1 | 2;

/** Tier of a stored model / chassis for the requested selection (0 = no match). */
function buildTierMatchers(
  canonicalMake: string,
  scope: RequestedModelScope,
  requestedGeneration: string
) {
  const exactModelKeys = modelKeySet(canonicalMake, scope.exact);
  const broadModelKeys = modelKeySet(canonicalMake, scope.broad);
  const modelTier = (model: string | null | undefined): MatchTier => {
    if (broadModelKeys.size === 0) return 1;
    const keys = [
      vehicleModelKey(model ?? ""),
      vehicleModelKey(canonicalVehicleModelLabel(canonicalMake, model ?? "")),
    ];
    if (keys.some((key) => exactModelKeys.has(key))) return 1;
    if (keys.some((key) => broadModelKeys.has(key))) return 2;
    return 0;
  };
  const chassisTier = (candidate: string | null | undefined): MatchTier => {
    if (!requestedGeneration) return 1;
    const level = vehicleChassisMatchLevel(candidate, requestedGeneration);
    if (level === "exact" || level === "descendant") return 1;
    return level === "ancestor" ? 2 : 0;
  };
  return { modelTier, chassisTier, hasModelFilter: broadModelKeys.size > 0 };
}

/**
 * Transitional compatibility bridge. Legacy product-owned fitment evidence has
 * broader coverage than the new policy projection, so use it only to resolve
 * product IDs. Cards, prices, media and pagination still come from the bounded
 * catalog projection.
 *
 * `exactIds` match the selected model (and its trims) and generation (and its
 * facelifts). `ids` additionally contain products filed on a broader label
 * only (`992` for `992.1`, `911` for `911 Carrera`).
 */
async function resolveLegacyVehicleProductTiersUncached(
  input: LegacyVehicleQuery
): Promise<LegacyVehicleTiers> {
  const canonicalMake = canonicalVehicleMakeLabel(input.make ?? "");
  const makeAliases = input.make ? vehicleMakeAliases(canonicalMake) : [];
  const scope = requestedModelScope(canonicalMake, input);
  const [candidateIds, evidence, bmcCandidateIds] = await Promise.all([
    input.make
      ? findLegacyFitmentCandidateIds(input, canonicalMake, scope).catch(() => null)
      : Promise.resolve<string[] | null>(null),
    input.make
      ? getCachedVehicleEvidence(canonicalMake, makeAliases, input.year, scope, input.generation)
      : Promise.resolve<VehicleEvidence>({ applications: [], clauses: [] }),
    input.make && normalizeShopSearchText(input.brand) === "bmc"
      ? prisma.shopProduct
          .findMany({
            where: {
              isPublished: true,
              status: "ACTIVE",
              OR: [
                { brand: { equals: "BMC", mode: "insensitive" } },
                { vendor: { equals: "BMC", mode: "insensitive" } },
              ],
            },
            select: { id: true },
          })
          .then((rows) => rows.map((row) => row.id))
      : Promise.resolve<string[]>([]),
  ]);
  // Canonical relation evidence can resolve IDs without loading their product
  // payload. Only parse bounded text candidates for the historical fallback.
  const candidatesIncludingBmcContracts =
    bmcCandidateIds.length > 0
      ? [...new Set([...(candidateIds ?? []), ...bmcCandidateIds])]
      : candidateIds;
  const products = await getCachedFitmentProducts(candidatesIncludingBmcContracts);
  const { applications: canonicalApplications, clauses: projectionClauses } = evidence;
  const exactIds = new Set<string>();
  const ids = new Set<string>();
  for (const product of products) {
    if (!product.id) continue;
    const matchesAt = (models: readonly string[], includeAncestors: boolean) => {
      const [first, ...rest] = models;
      return product.fitments.some((fitment) =>
        shopFitmentMatchesVehicleConstraints(fitment, {
          make: canonicalMake,
          model: first ?? input.model,
          modelAlternates: rest,
          chassis: input.generation,
          chassisIncludesAncestors: includeAncestors,
          year: input.year,
        })
      );
    };
    if (matchesAt(scope.exact, false)) {
      exactIds.add(product.id);
      ids.add(product.id);
    } else if (matchesAt(scope.broad, true)) {
      ids.add(product.id);
    }
  }
  const requestedGeneration = input.generation?.trim() ?? "";
  const { modelTier, chassisTier, hasModelFilter } = buildTierMatchers(
    canonicalMake,
    scope,
    requestedGeneration
  );
  const record = (productId: string, tier: MatchTier) => {
    if (!tier) return;
    ids.add(productId);
    if (tier === 1) exactIds.add(productId);
  };
  for (const application of canonicalApplications) {
    const model = modelTier(application.model);
    const chassis = chassisTier(application.chassisCode);
    if (!model || !chassis) continue;
    if (
      input.year &&
      ((application.yearFrom != null && application.yearFrom > input.year) ||
        (application.yearTo != null && application.yearTo < input.year))
    ) {
      continue;
    }
    record(application.productId, Math.max(model, chassis) as MatchTier);
  }
  for (const clause of projectionClauses) {
    const exactTextValues = (dimensions: readonly string[]) =>
      clause.constraints
        .filter(
          (constraint) =>
            dimensions.includes(constraint.dimension) &&
            constraint.state === "EXACT" &&
            Boolean(constraint.textValue)
        )
        .map((constraint) => constraint.textValue!);
    if (
      input.make &&
      !exactTextValues(["MAKE"]).some((value) => canonicalVehicleMakeLabel(value) === canonicalMake)
    ) {
      continue;
    }
    let model: MatchTier = 1;
    if (hasModelFilter) {
      const tiers = exactTextValues(["MODEL"]).map(modelTier).filter(Boolean);
      model = tiers.length ? (Math.min(...tiers) as MatchTier) : 0;
    }
    let chassis: MatchTier = 1;
    if (requestedGeneration) {
      const tiers = exactTextValues(["GENERATION", "CHASSIS"]).map(chassisTier).filter(Boolean);
      chassis = tiers.length ? (Math.min(...tiers) as MatchTier) : 0;
    }
    if (!model || !chassis) continue;
    if (input.year) {
      const yearConstraints = clause.constraints.filter(
        (constraint) => constraint.dimension === "YEAR" && constraint.state === "EXACT"
      );
      if (
        yearConstraints.length === 0 ||
        !yearConstraints.some(
          (constraint) =>
            (constraint.yearFrom == null || constraint.yearFrom <= input.year!) &&
            (constraint.yearTo == null || constraint.yearTo >= input.year!)
        )
      ) {
        continue;
      }
    }
    record(clause.productId, Math.max(model, chassis) as MatchTier);
  }
  return { ids: [...ids], exactIds: [...exactIds] };
}

export async function resolveLegacyVehicleProductTiers(
  input: LegacyVehicleQuery
): Promise<LegacyVehicleTiers | null> {
  if (!input.make && !input.model && !input.generation && !input.year) return null;

  const key = vehicleQueryCacheKey(input);
  const cached = sharedCache.resolvedVehicleIds.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      // Refresh recency for bounded LRU eviction.
      sharedCache.resolvedVehicleIds.delete(key);
      sharedCache.resolvedVehicleIds.set(key, cached);
      return { ids: cached.ids, exactIds: cached.exactIds };
    }
    sharedCache.resolvedVehicleIds.delete(key);
  }

  const pending = sharedCache.pendingVehicleResolutions.get(key);
  if (pending) return pending;

  const promise = resolveLegacyVehicleProductTiersUncached(input)
    .then((tiers) => {
      cacheResolvedVehicleIds(key, tiers);
      return tiers;
    })
    .finally(() => {
      // Do not retain rejected promises (or completed flights) indefinitely.
      sharedCache.pendingVehicleResolutions.delete(key);
    });
  sharedCache.pendingVehicleResolutions.set(key, promise);
  return promise;
}

export async function resolveLegacyVehicleProductIds(input: LegacyVehicleQuery) {
  return (await resolveLegacyVehicleProductTiers(input))?.ids ?? null;
}

export type LegacyVehicleChassisOptions = { codes: string[]; counts: Record<string, number> };

/**
 * Chassis/generation options for a selected model, computed with the same
 * matching rules as the listing, so every option opens at least one product.
 * A facelift makes its generation selectable too (`992.1` -> `992`), and the
 * count of an option is the number of products its selection returns exactly.
 */
export async function listLegacyVehicleChassisOptions(input: {
  make: string;
  model: string;
}): Promise<LegacyVehicleChassisOptions | null> {
  const canonicalMake = canonicalVehicleMakeLabel(input.make);
  const makeAliases = vehicleMakeAliases(canonicalMake);
  const legacyInput = { make: input.make, model: input.model };
  const scope = requestedModelScope(canonicalMake, legacyInput);
  const [candidateIds, evidence] = await Promise.all([
    findLegacyFitmentCandidateIds(legacyInput, canonicalMake, scope).catch(() => null),
    getCachedVehicleEvidence(canonicalMake, makeAliases, null, scope, null),
  ]);
  const products = candidateIds ? await getCachedFitmentProducts(candidateIds) : [];
  const { modelTier } = buildTierMatchers(canonicalMake, scope, "");
  const labels = new Map<string, string>();
  const productsByOption = new Map<string, Set<string>>();
  const add = (productId: string | undefined, code: string | null | undefined) => {
    if (!productId || !code?.trim()) return;
    for (const option of vehicleChassisSelfAndAncestors(code.trim())) {
      const key = vehicleChassisKey(option);
      if (!key) continue;
      if (!labels.has(key)) labels.set(key, option);
      const set = productsByOption.get(key) ?? new Set<string>();
      set.add(productId);
      productsByOption.set(key, set);
    }
  };
  const [primary, ...others] = scope.exact;
  for (const product of products) {
    for (const fitment of product.fitments) {
      if (
        !shopFitmentMatchesVehicleConstraints(fitment, {
          make: canonicalMake,
          model: primary ?? input.model,
          modelAlternates: others,
        })
      ) {
        continue;
      }
      for (const code of fitment.chassisCodes) add(product.id, code);
    }
  }
  for (const application of evidence.applications) {
    if (modelTier(application.model) === 1) add(application.productId, application.chassisCode);
  }
  for (const clause of evidence.clauses) {
    const values = (dimensions: readonly string[]) =>
      clause.constraints
        .filter(
          (constraint) =>
            dimensions.includes(constraint.dimension) &&
            constraint.state === "EXACT" &&
            Boolean(constraint.textValue)
        )
        .map((constraint) => constraint.textValue!);
    if (!values(["MAKE"]).some((value) => canonicalVehicleMakeLabel(value) === canonicalMake)) {
      continue;
    }
    if (!values(["MODEL"]).some((value) => modelTier(value) === 1)) continue;
    for (const code of values(["GENERATION", "CHASSIS"])) add(clause.productId, code);
  }
  if (labels.size === 0) return null;
  const codes = canonicalizeVehicleChassisCodes([...labels.values()], canonicalMake, input.model);
  const counts: Record<string, number> = {};
  for (const code of codes) {
    counts[code] = productsByOption.get(vehicleChassisKey(code))?.size ?? 0;
  }
  return { codes: codes.filter((code) => counts[code] > 0), counts };
}
