import { unstable_cache } from "next/cache";
import { getCanonicalFitmentOptions } from "@/lib/shopCanonicalFitmentOptions.server";
import {
  SHOP_CATALOG_SELECTOR_CACHE_SECONDS,
  SHOP_CATALOG_SELECTOR_CACHE_TAG,
} from "@/lib/shopCatalogSelectorCache";
import { prisma } from "@/lib/prisma";
import {
  parseSupplierFitmentContract,
  supplierContractToNormalizedFitment,
  SUPPLIER_FITMENT_KEY,
} from "@/lib/shopImportFitment";
import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "@/lib/shopStockSearch.server";
import {
  isShopCatalogReaderRequestEnabled,
  resolveShopCatalogReaderFlag,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import { shopVehicleMakesMatch, shopVehicleModelsMatch } from "@/lib/shopVehicleConstraints";
import { getVehicleSelectorModelAliases } from "@/lib/shopVehicleSearch";
import {
  listLegacyVehicleChassisOptions,
  resolveLegacyVehicleProductIds,
} from "@/lib/shopCatalogLegacyVehicleIds.server";
import {
  listProjectionVehicleChassisOptions,
  withModelFamilyBases,
} from "@/lib/shopVehicleSelectorProjectionOptions.server";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import {
  canonicalizeVehicleMakes,
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";
import { vehicleChassisMatchLevel, vehicleModelScope } from "@/lib/shopVehicleHierarchy";

const cachedJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      // Selector responses are public, price-free and keyed entirely by the
      // request URL. Their options change only when fitment is published, so
      // the CDN keeps them for the same bounded window as the server cache
      // and serves a stale copy while refreshing instead of re-running the
      // multi-join selector SQL (0.5-2.4 s) for every visitor.
      "Cache-Control": `public, max-age=60, s-maxage=${SHOP_CATALOG_SELECTOR_CACHE_SECONDS}, stale-while-revalidate=86400`,
    },
  });

// The legacy fallback runs only when the canonical selector is unavailable,
// and its body depends on the reader gate (a canary request gets 503 for the
// same URL). Keep its original short shared lifetime so a legacy response
// cannot occupy the CDN for long.
const legacyFallbackJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
    },
  });

type SupplierVehicleApplication = {
  make: string;
  model: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};
let cachedBmcApplications: { expiresAt: number; value: SupplierVehicleApplication[] } | null = null;
let pendingBmcApplications: Promise<SupplierVehicleApplication[]> | null = null;

async function getBmcSupplierApplications(): Promise<SupplierVehicleApplication[]> {
  if (cachedBmcApplications && cachedBmcApplications.expiresAt > Date.now()) {
    return cachedBmcApplications.value;
  }
  if (pendingBmcApplications) return pendingBmcApplications;
  pendingBmcApplications = (async () => {
    const products = await prisma.shopProduct.findMany({
      where: {
        isPublished: true,
        status: "ACTIVE",
        OR: [
          { brand: { equals: "BMC", mode: "insensitive" } },
          { vendor: { equals: "BMC", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    const productIds = products.map((product) => product.id);
    if (!productIds.length) return [];
    const metafields = await prisma.shopProductMetafield.findMany({
      where: {
        productId: { in: productIds },
        namespace: "onecompany",
        key: SUPPLIER_FITMENT_KEY,
      },
      select: { value: true },
    });
    const applications = metafields.flatMap((metafield) => {
      const contract = parseSupplierFitmentContract(metafield.value);
      if (!contract || contract.mode !== "vehicle_specific" || contract.scope !== "auto") return [];
      return supplierContractToNormalizedFitment(contract).applications.map((application) => ({
        make: application.make,
        model: application.models[0] ?? null,
        chassisCode: application.chassisCodes[0] ?? null,
        yearFrom: application.yearRanges[0]?.from ?? null,
        yearTo: application.yearRanges[0]?.to ?? null,
      }));
    });
    cachedBmcApplications = { value: applications, expiresAt: Date.now() + 60_000 };
    return applications;
  })().finally(() => {
    pendingBmcApplications = null;
  });
  return pendingBmcApplications;
}

async function supplementBmcSupplierFitment<T extends { type?: string; data?: unknown }>(
  result: T | null,
  input: {
    make: string | null;
    model: string | null;
    chassis: string | null;
    brand: string | null;
    scope: "auto" | "moto" | null;
  }
): Promise<T | null> {
  if (!result || (input.brand && input.brand.toLocaleLowerCase() !== "bmc")) return result;
  const applications = (await getBmcSupplierApplications()).filter((application) =>
    isVehicleMakeCompatibleWithScope(application.make, input.scope)
  );
  if (result.type === "makes" && Array.isArray(result.data)) {
    return {
      ...result,
      data: canonicalizeVehicleMakes([
        ...result.data.filter((value): value is string => typeof value === "string"),
        ...applications.map((application) => application.make),
      ]),
    };
  }
  const forMake = applications.filter((application) =>
    input.make ? shopVehicleMakesMatch(application.make, input.make) : false
  );
  if (result.type === "models" && Array.isArray(result.data) && input.make) {
    return {
      ...result,
      data: canonicalizeVehicleModels(input.make, [
        ...result.data.filter((value): value is string => typeof value === "string"),
        ...forMake
          .map((application) => application.model)
          .filter((value): value is string => Boolean(value)),
      ]),
    };
  }
  const forModel = forMake.filter(
    (application) =>
      Boolean(
        application.model &&
          input.model &&
          shopVehicleModelsMatch(application.model, input.model, application.make)
      ) &&
      (!input.chassis ||
        application.chassisCode?.toLocaleLowerCase() === input.chassis.toLocaleLowerCase())
  );
  if (result.type === "chassis" && Array.isArray(result.data) && input.make && input.model) {
    return {
      ...result,
      data: canonicalizeVehicleChassisCodes(
        [
          ...result.data.filter((value): value is string => typeof value === "string"),
          ...forModel
            .map((application) => application.chassisCode)
            .filter((value): value is string => Boolean(value)),
        ],
        input.make,
        input.model
      ),
    };
  }
  if (
    result.type === "details" &&
    input.make &&
    input.model &&
    result.data &&
    typeof result.data === "object"
  ) {
    const years = new Set<number>(
      "years" in result.data && Array.isArray(result.data.years) ? result.data.years : []
    );
    const maxYear = new Date().getFullYear() + 2;
    for (const application of forModel) {
      if (application.yearFrom == null) continue;
      for (
        let year = Math.max(1886, application.yearFrom);
        year <= Math.min(maxYear, application.yearTo ?? maxYear);
        year += 1
      ) {
        years.add(year);
      }
    }
    return {
      ...result,
      data: { ...result.data, years: [...years].sort((left, right) => right - left) },
    };
  }
  return result;
}

type SelectorOptionsInput = Parameters<typeof getCanonicalFitmentOptions>[0];

/** At most this many (model, chassis) detail reads are merged per request. */
const DETAIL_HIERARCHY_READ_LIMIT = 24;

/**
 * Years and engines of a selection follow the listing's hierarchy: a base
 * model includes its trims and a generation (`992`) its facelifts (`992.1`).
 */
async function withHierarchyDetails<T extends { type?: string; data?: unknown }>(
  result: T,
  input: SelectorOptionsInput
): Promise<T> {
  if (result.type !== "details" || !input.make || !input.model) return result;
  if (!result.data || typeof result.data !== "object") return result;
  const models = vehicleModelScope(input.make, input.model).exact;
  let chassisCodes: (string | null)[] = [input.chassis];
  if (input.chassis) {
    const listed = await Promise.all(
      models.map((model) =>
        getCanonicalFitmentOptions({ ...input, model, chassis: null, details: false }).catch(
          () => null
        )
      )
    );
    const descendants = listed
      .flatMap((options) => (Array.isArray(options?.data) ? options.data : []))
      .filter(
        (code): code is string =>
          typeof code === "string" && vehicleChassisMatchLevel(code, input.chassis) === "descendant"
      );
    chassisCodes = [...new Set([input.chassis, ...descendants])];
  }
  const reads = models
    .flatMap((model) => chassisCodes.map((chassis) => ({ model, chassis })))
    .filter(({ model, chassis }) => model !== input.model || chassis !== input.chassis)
    .slice(0, DETAIL_HIERARCHY_READ_LIMIT);
  if (reads.length === 0) return result;
  const extra = await Promise.all(
    reads.map(({ model, chassis }) =>
      getCanonicalFitmentOptions({ ...input, model, chassis, details: true }).catch(() => null)
    )
  );
  const data = result.data as { years?: unknown; engines?: unknown };
  const years = new Set<number>(Array.isArray(data.years) ? data.years : []);
  const engines = new Set<string>(Array.isArray(data.engines) ? data.engines : []);
  for (const options of extra) {
    const value = options?.type === "details" ? (options.data as typeof data) : null;
    for (const year of Array.isArray(value?.years) ? value.years : []) years.add(year);
    for (const engine of Array.isArray(value?.engines) ? value.engines : []) engines.add(engine);
  }
  return {
    ...result,
    data: {
      ...data,
      years: [...years].sort((left, right) => right - left),
      engines: [...engines].sort((left, right) => left.localeCompare(right)),
    },
  };
}

function isProjectionVehicleReader() {
  return process.env.SHOP_CATALOG_V2_VEHICLE_READER_MODE?.trim().toLowerCase() === "projection";
}

/** Projection reader: options follow the verified clauses, no legacy bridge. */
async function refineProjectionSelectorOptions<
  T extends { type?: string; data?: unknown; make?: string },
>(result: T, input: SelectorOptionsInput): Promise<T | (T & { counts: Record<string, number> })> {
  if (result.type === "chassis" && result.make && input.model) {
    const options = await listProjectionVehicleChassisOptions({
      make: result.make,
      model: input.model,
      scope: input.scope,
    }).catch(() => null);
    return options?.codes.length
      ? { ...result, data: options.codes, counts: options.counts }
      : result;
  }
  if (result.type === "models" && result.make && Array.isArray(result.data)) {
    return {
      ...result,
      data: canonicalizeVehicleModels(
        result.make,
        withModelFamilyBases(
          result.make,
          result.data.filter((value): value is string => typeof value === "string")
        )
      ),
    };
  }
  return result;
}

/**
 * The picker may only offer what the listing can open. Chassis options come
 * from the listing's own matching rules (a facelift also makes its generation
 * selectable); model labels the vehicle search merely recognises are offered
 * only when they return products.
 */
async function refineSelectorOptions<T extends { type?: string; data?: unknown; make?: string }>(
  result: T | null,
  input: SelectorOptionsInput,
  readerMode: string
): Promise<T | (T & { counts: Record<string, number> }) | null> {
  // Moto pickers keep their canonical options: the refinements below read
  // automotive evidence.
  if (!result || input.brand || input.scope === "moto") return result;
  if (result.type === "details") return withHierarchyDetails(result, input);
  if (readerMode === "projection") return refineProjectionSelectorOptions(result, input);
  if (result.type === "chassis" && result.make && input.model) {
    const options = await listLegacyVehicleChassisOptions({
      make: result.make,
      model: input.model,
    }).catch(() => null);
    return options?.codes.length
      ? { ...result, data: options.codes, counts: options.counts }
      : result;
  }
  if (result.type === "models" && result.make && Array.isArray(result.data)) {
    const make = result.make;
    const present = new Set(
      result.data.filter((value): value is string => typeof value === "string").map(vehicleModelKey)
    );
    const recognised = getVehicleSelectorModelAliases(make).filter(
      (label) => !present.has(vehicleModelKey(label))
    );
    const verified = await Promise.all(
      recognised.map(async (label) => {
        const ids = await resolveLegacyVehicleProductIds({ make, model: label }).catch(() => null);
        return ids?.length ? label : null;
      })
    );
    return {
      ...result,
      data: canonicalizeVehicleModels(make, [
        ...result.data.filter((value): value is string => typeof value === "string"),
        ...verified.filter((label): label is string => Boolean(label)),
      ]),
    };
  }
  return result;
}

// Shared across requests and instances (Next data cache). Errors are not
// cached; a null result (selector artifact unavailable) is, for the same TTL.
// The reader mode is an argument so it is part of the cache key: switching
// readers never serves options computed by the other one.
const readCachedSelectorOptions = unstable_cache(
  async (input: SelectorOptionsInput, readerMode: string) =>
    refineSelectorOptions(
      await supplementBmcSupplierFitment(await getCanonicalFitmentOptions(input), {
        make: input.make,
        model: input.model,
        chassis: input.chassis,
        brand: input.brand,
        scope: input.scope,
      }),
      input,
      readerMode
    ),
  ["shop-fitment-selector-options-v5"],
  { revalidate: SHOP_CATALOG_SELECTOR_CACHE_SECONDS, tags: [SHOP_CATALOG_SELECTOR_CACHE_TAG] }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const chassis = searchParams.get("chassis");
    const rawYear = searchParams.get("year")?.trim() ?? "";
    const yearNumber = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
    const year =
      yearNumber != null && yearNumber >= 1886 && yearNumber <= new Date().getFullYear() + 2
        ? yearNumber
        : null;
    if (rawYear && year == null) {
      return NextResponse.json({ error: "Invalid vehicle year" }, { status: 400 });
    }
    const brand = searchParams.get("brand")?.trim() || null;
    const details = searchParams.get("details") === "1";
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

    const canonical = await readCachedSelectorOptions(
      {
        make,
        model,
        chassis,
        year,
        brand,
        scope: vehicleScope,
        details,
      },
      isProjectionVehicleReader() ? "projection" : "legacy"
    );
    if (
      canonical?.type === "models" &&
      isVehicleMakeCompatibleWithScope(canonical.make, vehicleScope)
    ) {
      return cachedJson({
        ...canonical,
        data: canonicalizeVehicleModels(canonical.make, canonical.data),
      });
    }
    if (
      canonical?.type === "chassis" &&
      isVehicleMakeCompatibleWithScope(canonical.make, vehicleScope)
    ) {
      return cachedJson({
        ...canonical,
        data: canonicalizeVehicleChassisCodes(canonical.data, canonical.make, canonical.model),
      });
    }
    if (canonical) return cachedJson(canonical);

    // An enabled projection reader must never fall through to the legacy
    // whole-catalog loader.  A complete selector artifact is the release
    // contract; until its versioned coverage marker is published, return a
    // retryable bounded response and keep the customer on the legacy reader
    // through the normal route flag/proxy path.
    const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
    if (
      isShopCatalogReaderRequestEnabled(
        reader,
        request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER)
      )
    ) {
      return NextResponse.json(
        {
          error: "Catalog fitment selector is temporarily unavailable",
          code: "SELECTOR_NOT_READY",
          data: [],
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "Retry-After": "15",
          },
        }
      );
    }

    // Transitional fallback until a category has completed its Knowledge V2
    // backfill. It remains deterministic and never relaxes selected values.
    const allProductsWithFitments = await getShopProductsWithFitments();
    const brandScopedProducts = brand
      ? allProductsWithFitments.filter((item) =>
          [item.product.brand, item.product.vendor].some(
            (value) => value?.trim().toLocaleLowerCase() === brand.toLocaleLowerCase()
          )
        )
      : allProductsWithFitments;
    const productsWithFitments = filterShopStockItemsByVehicleScope(
      brandScopedProducts,
      vehicleScope
    );

    if (details && make && model) {
      const matchingFitments = productsWithFitments.flatMap((item) =>
        item.fitments.filter(
          (fitment) =>
            shopVehicleMakesMatch(fitment.make, make) &&
            fitment.models.some((candidate: string) =>
              shopVehicleModelsMatch(candidate, model, fitment.make)
            ) &&
            (!chassis ||
              fitment.chassisCodes.some(
                (candidate: string) => candidate.toLocaleLowerCase() === chassis.toLocaleLowerCase()
              ))
        )
      );
      const maxYear = new Date().getFullYear() + 2;
      const years = new Set<number>();
      for (const fitment of matchingFitments) {
        for (const range of fitment.yearRanges) {
          const from = Math.max(1886, range.from ?? 1886);
          const to = Math.min(maxYear, range.to ?? maxYear);
          for (let year = from; year <= to; year += 1) years.add(year);
        }
      }
      return legacyFallbackJson({
        type: "details",
        make,
        model,
        chassis,
        data: { years: [...years].sort((left, right) => right - left), engines: [] },
      });
    }

    // Legacy fitment does not have a dependable engine field. Keep the
    // selector precise rather than reusing the chassis response at this level.
    if (make && model && chassis) {
      return legacyFallbackJson({ type: "engines", make, model, chassis, data: [] });
    }

    // Level 0: Return unique makes
    if (!make) {
      const makesSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (fitment.make && isVehicleMakeCompatibleWithScope(fitment.make, vehicleScope)) {
            makesSet.add(fitment.make);
          }
        }
      }
      const makes = canonicalizeVehicleMakes(Array.from(makesSet));
      return legacyFallbackJson({ type: "makes", data: makes });
    }

    // Level 1: Make → Models
    if (make && !model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return legacyFallbackJson({ type: "models", make, data: [] });
      }
      const modelsSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (shopVehicleMakesMatch(fitment.make, make)) {
            for (const modelVal of fitment.models) {
              modelsSet.add(modelVal);
            }
          }
        }
      }
      const models = canonicalizeVehicleModels(make, [
        ...modelsSet,
        ...getVehicleSelectorModelAliases(make),
      ]);
      return legacyFallbackJson({ type: "models", make, data: models });
    }

    // Level 2: Make + Model → Chassis
    if (make && model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return legacyFallbackJson({ type: "chassis", make, model, data: [] });
      }
      const chassisSet = new Set<string>();
      for (const item of productsWithFitments) {
        for (const fitment of item.fitments) {
          if (
            shopVehicleMakesMatch(fitment.make, make) &&
            fitment.models.some((candidate: string) =>
              shopVehicleModelsMatch(candidate, model, fitment.make)
            )
          ) {
            for (const code of fitment.chassisCodes) {
              chassisSet.add(code);
            }
          }
        }
      }
      const chassis = canonicalizeVehicleChassisCodes([...chassisSet], make, model);
      return legacyFallbackJson({ type: "chassis", make, model, data: chassis });
    }

    return legacyFallbackJson({ data: [] });
  } catch (error: any) {
    console.error("[Fitment API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
