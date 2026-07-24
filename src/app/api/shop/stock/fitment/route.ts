import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "../search/route";
import { isExpectedChassisForMakeModel, isKnownVehicleModelForMake } from "@/lib/crossShopFitment";
import { prisma } from "@/lib/prisma";
import { shopVehicleMakesMatch, shopVehicleModelsMatch } from "@/lib/shopVehicleConstraints";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";

const cachedJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      // Keep selector data fast while bounding stale fitment exposure after a
      // controlled Knowledge V2 reindex.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
    },
  });

let canonicalCoverageCache: { expiresAt: number; ready: boolean } | null = null;

async function hasCanonicalCatalogCoverage() {
  const now = Date.now();
  if (canonicalCoverageCache && canonicalCoverageCache.expiresAt > now) {
    return canonicalCoverageCache.ready;
  }
  const [publishedProducts, indexedProducts, activeApplications] = await Promise.all([
    prisma.shopProduct.count({ where: { isPublished: true, status: "ACTIVE" } }),
    prisma.shopProductKnowledge.count({
      where: {
        schemaVersion: { gte: 2 },
        activeRevision: { gt: 0 },
        status: { in: ["READY", "NEEDS_REVIEW"] },
        product: { isPublished: true, status: "ACTIVE" },
      },
    }),
    prisma.shopVehicleApplication.count({
      where: {
        isActive: true,
        verificationStatus: { not: "BLOCKED" },
        product: { isPublished: true, status: "ACTIVE" },
      },
    }),
  ]);
  const ready =
    publishedProducts > 0 && indexedProducts / publishedProducts >= 0.95 && activeApplications > 0;
  canonicalCoverageCache = { expiresAt: now + 5 * 60_000, ready };
  return ready;
}

async function getCanonicalFitmentOptions(input: {
  make: string | null;
  model: string | null;
  scope: "auto" | "moto" | null;
}) {
  if (!(await hasCanonicalCatalogCoverage())) return null;
  const baseWhere = {
    isActive: true,
    isUniversal: false,
    verificationStatus: { not: "BLOCKED" as const },
    ...(input.scope ? { scope: input.scope } : {}),
    product: { isPublished: true, status: "ACTIVE" as const },
  };
  const available = await prisma.shopVehicleApplication.findFirst({
    where: baseWhere,
    select: { id: true },
  });
  if (!available) return null;

  if (!input.make) {
    const rows = await prisma.shopVehicleApplication.findMany({
      where: { ...baseWhere, make: { not: null } },
      distinct: ["make"],
      select: { make: true },
      orderBy: { make: "asc" },
    });
    return {
      type: "makes" as const,
      data: rows
        .map((row) => row.make)
        .filter((value): value is string => Boolean(value))
        .filter((value) => isVehicleMakeCompatibleWithScope(value, input.scope)),
    };
  }

  if (!input.model) {
    const rows = await prisma.shopVehicleApplication.findMany({
      where: {
        ...baseWhere,
        make: { equals: input.make, mode: "insensitive" },
        model: { not: null },
      },
      distinct: ["model"],
      select: { model: true },
      orderBy: { model: "asc" },
    });
    let data = rows
      .map((row) => row.model)
      .filter((value): value is string => Boolean(value))
      .filter((value) => isKnownVehicleModelForMake(input.make ?? "", value));
    if (
      input.make.toLowerCase() === "porsche" &&
      data.some((modelName) => /^911\s+\S/i.test(modelName))
    ) {
      data = data.filter((modelName) => modelName.toLowerCase() !== "911");
    }
    return { type: "models" as const, make: input.make, data };
  }

  const rows = await prisma.shopVehicleApplication.findMany({
    where: {
      ...baseWhere,
      make: { equals: input.make, mode: "insensitive" },
      model: { equals: input.model, mode: "insensitive" },
      chassisCode: { not: null },
    },
    distinct: ["chassisCode"],
    select: { chassisCode: true },
    orderBy: { chassisCode: "asc" },
  });
  return {
    type: "chassis" as const,
    make: input.make,
    model: input.model,
    data: rows
      .map((row) => row.chassisCode)
      .filter((value): value is string => Boolean(value))
      .filter((value) => isExpectedChassisForMakeModel(input.make ?? "", input.model ?? "", value)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

    const canonical = await getCanonicalFitmentOptions({ make, model, scope: vehicleScope });
    if (canonical) return cachedJson(canonical);

    // Transitional fallback until a category has completed its Knowledge V2
    // backfill. It remains deterministic and never relaxes selected values.
    const allProductsWithFitments = await getShopProductsWithFitments();
    const productsWithFitments = filterShopStockItemsByVehicleScope(
      allProductsWithFitments,
      vehicleScope
    );

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
      const makes = Array.from(makesSet).sort((a, b) => a.localeCompare(b));
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
              if (isKnownVehicleModelForMake(make, modelVal)) modelsSet.add(modelVal);
            }
          }
        }
      }
      let models = Array.from(modelsSet).sort((a, b) => a.localeCompare(b));
      if (
        make.toLowerCase() === "porsche" &&
        models.some((modelName) => /^911\s+\S/i.test(modelName))
      ) {
        // A generic 911 choice mixes Carrera, Turbo and GT fitments. Once
        // product-family evidence exists, require the customer to choose it.
        models = models.filter((modelName) => modelName.toLowerCase() !== "911");
      }
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
            fitment.models.some((candidate: string) => shopVehicleModelsMatch(candidate, model))
          ) {
            for (const code of fitment.chassisCodes) {
              if (isExpectedChassisForMakeModel(make, model, code)) {
                chassisSet.add(code);
              }
            }
          }
        }
      }
      const chassis = Array.from(chassisSet).sort((a, b) => a.localeCompare(b));
      return cachedJson({ type: "chassis", make, model, data: chassis });
    }

    return cachedJson({ data: [] });
  } catch (error: any) {
    console.error("[Fitment API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
