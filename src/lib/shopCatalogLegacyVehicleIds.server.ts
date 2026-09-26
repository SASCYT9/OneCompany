import "server-only";

import { extractProductFitment } from "@/lib/crossShopFitment";
import { getShopFitmentCatalogProducts } from "@/lib/shopFitmentCatalogServer";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import {
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
} from "@/lib/shopImportFitment";
import { resolveSearchFitments } from "@/lib/shopFitmentQuality";
import { prisma } from "@/lib/prisma";
import { Prisma, ShopCatalogCompatibilityDimension } from "@prisma/client";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import {
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

type LegacyVehicleQuery = {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  year?: number | null;
};

const CACHE_MS = 5 * 60_000;

// Resolving the legacy bridge requires two potentially large relation scans.
// Keep the final answer by normalized vehicle query as well, so repeated
// requests do not repeat those scans while the fitment catalog is warm.
const RESOLUTION_CACHE_MS = 60_000;
const RESOLUTION_CACHE_MAX_ENTRIES = 256;

type CachedFitmentProducts = Array<{
  id: string | undefined;
  fitment: ReturnType<typeof extractProductFitment>;
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
  resolvedVehicleIds: Map<string, { ids: string[]; expiresAt: number }>;
  pendingVehicleResolutions: Map<string, Promise<string[]>>;
  evidence: Map<string, { value: VehicleEvidence; expiresAt: number }>;
  pendingEvidence: Map<string, Promise<VehicleEvidence>>;
};
const globalCache = globalThis as typeof globalThis & {
  __oneCompanyLegacyVehicleCacheV1?: LegacyVehicleCacheState;
};
const sharedCache: LegacyVehicleCacheState = (globalCache.__oneCompanyLegacyVehicleCacheV1 ??= {
  cachedProducts: null,
  cachedAt: 0,
  resolvedVehicleIds: new Map(),
  pendingVehicleResolutions: new Map(),
  evidence: new Map(),
  pendingEvidence: new Map(),
});

function vehicleQueryCacheKey(input: LegacyVehicleQuery) {
  return JSON.stringify([
    canonicalVehicleMakeLabel(input.make ?? ""),
    input.model ? vehicleModelKey(input.model) : "",
    normalizeShopSearchText(input.generation ?? ""),
    input.year ?? null,
  ]);
}

function cacheResolvedVehicleIds(key: string, ids: string[]) {
  sharedCache.resolvedVehicleIds.delete(key);
  sharedCache.resolvedVehicleIds.set(key, { ids, expiresAt: Date.now() + RESOLUTION_CACHE_MS });
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

async function indexFitmentProducts(products: Awaited<ReturnType<typeof getShopFitmentCatalogProducts>>) {
  const productIds = products
    .filter((product) => normalizeShopSearchText(product.brand) === "wheelforce")
    .map((product) => product.id)
    .filter((id): id is string => Boolean(id));
  const metafields = productIds.length
    ? await prisma.shopProductMetafield.findMany({
        where: {
          productId: { in: productIds },
          namespace: "onecompany",
          key: { in: ["normalized_fitment", SUPPLIER_FITMENT_KEY] },
        },
        select: { productId: true, key: true, value: true },
      })
    : [];
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
    const value =
      persisted?.normalized ??
      (supplier ? JSON.stringify(supplierContractToNormalizedFitment(supplier)) : null);
    return {
      id: product.id,
      fitment: resolveSearchFitments(automatic, value)[0] ?? automatic,
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
 * Keep the legacy bridge broad enough for historical feeds, but bound the
 * product read to rows that can actually mention the selected vehicle. The
 * previous implementation loaded and parsed the entire active catalog before
 * checking the vehicle, which made a cold filter request several seconds.
 */
async function findLegacyFitmentCandidateIds(input: LegacyVehicleQuery, canonicalMake: string) {
  const makeKey = canonicalMake.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, "-");
  const makeValues = [
    ...new Set([canonicalMake, ...(input.make ? vehicleMakeAliases(canonicalMake) : [])]),
  ];
  const modelValues = input.model ? vehicleModelAliases(canonicalMake, input.model) : [];
  const generationValues = input.generation ? [input.generation] : [];
  const tagValues = new Set<string>();
  const modelTagValues = new Set<string>();
  const generationTagValues = new Set<string>();

  // A bare fits-make tag is intentionally broad. Use it only for a make-only
  // selection; model/generation selections get focused tags plus text joins.
  if (input.make && !input.model && !input.generation) {
    tagValues.add(`fits-make:${makeKey}`);
  }
  for (const model of modelValues) {
    const modelKey = model.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, "-");
    if (input.make) {
      modelTagValues.add(`fits-model:${makeKey}:${modelKey}`);
      modelTagValues.add(`fits:${makeKey}-${modelKey}`);
    }
    modelTagValues.add(`model:${modelKey}`);
  }
  for (const generation of generationValues) {
    const generationKey = generation.trim().toLowerCase();
    generationTagValues.add(`chassis:${generationKey}`);
    generationTagValues.add(`chassis:${generation.trim().toUpperCase()}`);
    for (const model of modelValues) {
      const modelKey = model.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, "-");
      if (input.make) generationTagValues.add(`fits-trim:${makeKey}:${modelKey}:${generationKey}`);
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
  if (tagValues.size > 0) alternatives.push({ tags: { hasSome: [...tagValues] } });
  if (input.make && (input.model || input.generation)) {
    const makeTag = `fits-make:${makeKey}`;
    const focusedTags = [...modelTagValues, ...generationTagValues];
    if (focusedTags.length > 0) {
      alternatives.push({ AND: [{ tags: { has: makeTag } }, { tags: { hasSome: focusedTags } }] });
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

async function getCachedVehicleEvidence(
  canonicalMake: string,
  makeAliases: string[],
  year?: number | null,
  model?: string | null,
  generation?: string | null
) {
  const modelAliases = model ? vehicleModelAliases(canonicalMake, model) : [];
  const generationValue = generation?.trim() || null;
  const key = JSON.stringify([
    canonicalMake,
    model ? vehicleModelKey(model) : null,
    generationValue ? normalizeShopSearchText(generationValue) : null,
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
    ...(generationValue
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
                textValue: { equals: generationValue, mode: "insensitive" as const },
              },
            },
          },
        ]
      : []),
  ];
  const promise = Promise.all([
    prisma.shopVehicleApplication.findMany({
      where: {
        isActive: true,
        isUniversal: false,
        verificationStatus: "VERIFIED",
        make: { in: makeAliases, mode: "insensitive" },
        ...(year
          ? {
              AND: [
                { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
                { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
              ],
            }
          : {}),
        ...(modelAliases.length ? { model: { in: modelAliases, mode: "insensitive" } } : {}),
        ...(generationValue
          ? { chassisCode: { equals: generationValue, mode: "insensitive" } }
          : {}),
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

/**
 * Transitional compatibility bridge. Legacy product-owned fitment evidence has
 * broader coverage than the new policy projection, so use it only to resolve
 * product IDs. Cards, prices, media and pagination still come from the bounded
 * catalog projection.
 */
async function resolveLegacyVehicleProductIdsUncached(input: LegacyVehicleQuery) {
  const canonicalMake = canonicalVehicleMakeLabel(input.make ?? "");
  const makeAliases = input.make ? vehicleMakeAliases(canonicalMake) : [];
  const [candidateIds, evidence] = await Promise.all([
    input.make
      ? findLegacyFitmentCandidateIds(input, canonicalMake).catch(() => null)
      : Promise.resolve<string[] | null>(null),
    input.make
      ? getCachedVehicleEvidence(
          canonicalMake,
          makeAliases,
          input.year,
          input.model,
          input.generation
        )
      : Promise.resolve<VehicleEvidence>({ applications: [], clauses: [] }),
  ]);
  // Canonical relation evidence can resolve IDs without loading their product
  // payload. Only parse bounded text candidates for the historical fallback.
  const products = await getCachedFitmentProducts(candidateIds);
  const { applications: canonicalApplications, clauses: projectionClauses } = evidence;
  const ids = new Set(
    products
      .filter((product) => {
        return shopFitmentMatchesVehicleConstraints(product.fitment, {
          make: canonicalMake,
          model: input.model,
          chassis: input.generation,
          year: input.year,
        });
      })
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id))
  );
  const requestedModel = input.model ? vehicleModelKey(input.model) : null;
  const requestedChassis = normalizeShopSearchText(input.generation ?? "");
  for (const application of canonicalApplications) {
    if (requestedModel && vehicleModelKey(application.model ?? "") !== requestedModel) continue;
    if (
      requestedChassis &&
      normalizeShopSearchText(application.chassisCode ?? "") !== requestedChassis
    ) {
      continue;
    }
    if (
      input.year &&
      ((application.yearFrom != null && application.yearFrom > input.year) ||
        (application.yearTo != null && application.yearTo < input.year))
    ) {
      continue;
    }
    ids.add(application.productId);
  }
  for (const clause of projectionClauses) {
    const exactTextValues = (dimension: "MAKE" | "MODEL" | "GENERATION") =>
      clause.constraints
        .filter(
          (constraint) =>
            constraint.dimension === dimension &&
            constraint.state === "EXACT" &&
            Boolean(constraint.textValue)
        )
        .map((constraint) => constraint.textValue!);
    if (
      input.make &&
      !exactTextValues("MAKE").some((value) => canonicalVehicleMakeLabel(value) === canonicalMake)
    ) {
      continue;
    }
    if (
      input.model &&
      !exactTextValues("MODEL").some(
        (value) =>
          vehicleModelKey(canonicalVehicleModelLabel(canonicalMake, value)) ===
          vehicleModelKey(canonicalVehicleModelLabel(canonicalMake, input.model!))
      )
    ) {
      continue;
    }
    if (
      input.generation &&
      !exactTextValues("GENERATION").some(
        (value) => normalizeShopSearchText(value) === normalizeShopSearchText(input.generation)
      )
    ) {
      continue;
    }
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
    ids.add(clause.productId);
  }
  return [...ids];
}

export async function resolveLegacyVehicleProductIds(input: LegacyVehicleQuery) {
  if (!input.make && !input.model && !input.generation && !input.year) return null;

  const key = vehicleQueryCacheKey(input);
  const cached = sharedCache.resolvedVehicleIds.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      // Refresh recency for bounded LRU eviction.
      sharedCache.resolvedVehicleIds.delete(key);
      sharedCache.resolvedVehicleIds.set(key, cached);
      return cached.ids;
    }
    sharedCache.resolvedVehicleIds.delete(key);
  }

  const pending = sharedCache.pendingVehicleResolutions.get(key);
  if (pending) return pending;

  const promise = resolveLegacyVehicleProductIdsUncached(input)
    .then((ids) => {
      cacheResolvedVehicleIds(key, ids);
      return ids;
    })
    .finally(() => {
      // Do not retain rejected promises (or completed flights) indefinitely.
      sharedCache.pendingVehicleResolutions.delete(key);
    });
  sharedCache.pendingVehicleResolutions.set(key, promise);
  return promise;
}
