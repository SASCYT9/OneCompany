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
import {
  getVehicleSelectorChassisAliases,
  getVehicleSelectorModelAliases,
} from "@/lib/shopVehicleSearch";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import {
  canonicalizeVehicleMakes,
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
} from "@/lib/shopVehicleTaxonomy";

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
        ...getVehicleSelectorModelAliases(input.make),
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
          ...getVehicleSelectorChassisAliases(input.make, input.model),
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

// Shared across requests and instances (Next data cache). Errors are not
// cached; a null result (selector artifact unavailable) is, for the same TTL.
const readCachedSelectorOptions = unstable_cache(
  async (input: SelectorOptionsInput) =>
    supplementBmcSupplierFitment(await getCanonicalFitmentOptions(input), {
      make: input.make,
      model: input.model,
      chassis: input.chassis,
      brand: input.brand,
      scope: input.scope,
    }),
  ["shop-fitment-selector-options-v1"],
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

    const canonical = await readCachedSelectorOptions({
      make,
      model,
      chassis,
      year,
      brand,
      scope: vehicleScope,
      details,
    });
    if (
      canonical?.type === "models" &&
      isVehicleMakeCompatibleWithScope(canonical.make, vehicleScope)
    ) {
      return cachedJson({
        ...canonical,
        data: canonicalizeVehicleModels(canonical.make, [
          ...canonical.data,
          ...getVehicleSelectorModelAliases(canonical.make),
        ]),
      });
    }
    if (
      canonical?.type === "chassis" &&
      isVehicleMakeCompatibleWithScope(canonical.make, vehicleScope)
    ) {
      return cachedJson({
        ...canonical,
        data: canonicalizeVehicleChassisCodes(
          [...canonical.data, ...getVehicleSelectorChassisAliases(canonical.make, canonical.model)],
          canonical.make,
          canonical.model
        ),
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
      return cachedJson({
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
      return cachedJson({ type: "engines", make, model, chassis, data: [] });
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
      return cachedJson({ type: "makes", data: makes });
    }

    // Level 1: Make → Models
    if (make && !model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "models", make, data: [] });
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
      return cachedJson({ type: "models", make, data: models });
    }

    // Level 2: Make + Model → Chassis
    if (make && model) {
      if (!isVehicleMakeCompatibleWithScope(make, vehicleScope)) {
        return cachedJson({ type: "chassis", make, model, data: [] });
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
      const chassis = canonicalizeVehicleChassisCodes(
        [...chassisSet, ...getVehicleSelectorChassisAliases(make, model)],
        make,
        model
      );
      return cachedJson({ type: "chassis", make, model, data: chassis });
    }

    return cachedJson({ data: [] });
  } catch (error: any) {
    console.error("[Fitment API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
