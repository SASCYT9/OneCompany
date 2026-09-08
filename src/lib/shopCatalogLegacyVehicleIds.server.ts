import "server-only";

import { extractProductFitment } from "@/lib/crossShopFitment";
import { getShopFitmentCatalogProducts } from "@/lib/shopFitmentCatalogServer";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import { prisma } from "@/lib/prisma";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import {
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  vehicleMakeAliases,
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

async function getCachedFitmentProducts() {
  if (sharedCache.cachedProducts && Date.now() - sharedCache.cachedAt < CACHE_MS) {
    return sharedCache.cachedProducts;
  }
  if (sharedCache.fitmentPending) return sharedCache.fitmentPending;
  sharedCache.fitmentPending = getShopFitmentCatalogProducts({ evidenceOnly: true })
    .then((products) => {
      sharedCache.cachedProducts = products.map((product) => ({
        id: product.id,
        fitment: extractProductFitment(product),
      }));
      sharedCache.cachedAt = Date.now();
      return sharedCache.cachedProducts;
    })
    .finally(() => {
      sharedCache.fitmentPending = undefined;
    });
  return sharedCache.fitmentPending;
}

async function getCachedVehicleEvidence(
  canonicalMake: string,
  makeAliases: string[],
  year?: number | null
) {
  const key = JSON.stringify([canonicalMake, year ?? null]);
  const cached = sharedCache.evidence.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    sharedCache.evidence.delete(key);
    sharedCache.evidence.set(key, cached);
    return cached.value;
  }
  if (cached) sharedCache.evidence.delete(key);
  const pending = sharedCache.pendingEvidence.get(key);
  if (pending) return pending;
  const promise = Promise.all([
    prisma.shopVehicleApplication.findMany({
      where: {
        isActive: true,
        isUniversal: false,
        verificationStatus: { not: "BLOCKED" },
        make: { in: makeAliases, mode: "insensitive" },
        ...(year
          ? {
              AND: [
                { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
                { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
              ],
            }
          : {}),
        product: { isPublished: true, status: "ACTIVE" },
      },
      select: { productId: true, model: true, chassisCode: true, yearFrom: true, yearTo: true },
    }),
    prisma.shopCatalogProjectionClause.findMany({
      where: {
        policy: { mode: { not: "UNIVERSAL" } },
        product: { isPublished: true, status: "ACTIVE" },
        constraints: {
          some: {
            dimension: "MAKE",
            state: "EXACT",
            textValue: { in: makeAliases, mode: "insensitive" },
          },
        },
        ...(year
          ? {
              AND: [
                {
                  constraints: {
                    some: {
                      dimension: "YEAR",
                      state: "EXACT",
                      AND: [
                        { OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] },
                        { OR: [{ yearTo: null }, { yearTo: { gte: year } }] },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
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
  const [products, evidence] = await Promise.all([
    getCachedFitmentProducts(),
    input.make
      ? getCachedVehicleEvidence(canonicalMake, makeAliases, input.year)
      : Promise.resolve<VehicleEvidence>({ applications: [], clauses: [] }),
  ]);
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
