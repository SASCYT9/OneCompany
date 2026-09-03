import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getShopProductsWithFitments } from "../search/route";
import { prisma } from "@/lib/prisma";
import { shopVehicleMakesMatch, shopVehicleModelsMatch } from "@/lib/shopVehicleConstraints";
import {
  filterShopStockItemsByVehicleScope,
  isVehicleMakeCompatibleWithScope,
  parseShopStockVehicleScope,
} from "@/lib/shopStockVehicleScope";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import {
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

const cachedJson = (body: unknown) =>
  NextResponse.json(body, {
    headers: {
      // Keep selector data fast while bounding stale fitment exposure after a
      // controlled Knowledge V2 reindex.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
    },
  });

async function getCanonicalFitmentOptions(input: {
  make: string | null;
  model: string | null;
  chassis: string | null;
  brand: string | null;
  scope: "auto" | "moto" | null;
  details: boolean;
}) {
  if (isLocalStorefrontMode()) return null;
  const productWhere: Prisma.ShopProductWhereInput = {
    isPublished: true,
    status: "ACTIVE",
    ...(input.brand
      ? {
          OR: [
            { brand: { equals: input.brand, mode: "insensitive" } },
            { vendor: { equals: input.brand, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const clauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
    product: productWhere,
  };
  const scopeClausePredicate: Prisma.ShopCatalogProjectionClauseWhereInput | null = input.scope
    ? { constraints: { some: { dimension: "SCOPE", state: "EXACT", textValue: input.scope } } }
    : null;
  if (scopeClausePredicate) clauseWhere.AND = [scopeClausePredicate];

  const exactValues = async (
    dimension: "MAKE" | "MODEL" | "GENERATION" | "CHASSIS" | "ENGINE",
    where: Prisma.ShopCatalogProjectionClauseWhereInput
  ) => {
    const rows = await prisma.shopCatalogProjectionConstraint.findMany({
      where: {
        dimension,
        state: "EXACT",
        textValue: { not: null },
        clause: where,
      },
      distinct: ["textValue"],
      select: { textValue: true },
      orderBy: { textValue: "asc" },
    });
    const values = rows.map((row) => row.textValue).filter((value): value is string => Boolean(value));
    return dimension === "CHASSIS" || dimension === "GENERATION"
      ? canonicalizeVehicleChassisCodes(values)
      : values;
  };

  if (!input.make) {
    const rows = await exactValues("MAKE", clauseWhere);
    if (!rows.length) return null;
    return {
      type: "makes" as const,
      data: rows.filter((value) => isVehicleMakeCompatibleWithScope(value, input.scope)),
    };
  }

  const makeClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
    ...clauseWhere,
    AND: [
      ...(scopeClausePredicate ? [scopeClausePredicate] : []),
      { constraints: { some: { dimension: "MAKE", state: "EXACT", textValue: { equals: input.make, mode: "insensitive" } } } },
    ],
  };

  if (!input.model) {
    const rows = await exactValues("MODEL", makeClauseWhere);
    if (!rows.length) return null;
    const data = canonicalizeVehicleModels(input.make, rows);
    return { type: "models" as const, make: input.make, data };
  }

  const modelRows = await exactValues("MODEL", makeClauseWhere);
  const requestedModelKey = vehicleModelKey(input.model);
  const modelAliases = modelRows
    .filter((value) => vehicleModelKey(value) === requestedModelKey);
  if (!modelAliases.length) modelAliases.push(input.model);

  const modelClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
    ...clauseWhere,
    AND: [
      ...(scopeClausePredicate ? [scopeClausePredicate] : []),
      { constraints: { some: { dimension: "MAKE", state: "EXACT", textValue: { equals: input.make, mode: "insensitive" } } } },
      { constraints: { some: { dimension: "MODEL", state: "EXACT", textValue: { in: modelAliases, mode: "insensitive" } } } },
    ],
  };

  if (input.details) {
    const detailClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = input.chassis
      ? {
          ...modelClauseWhere,
          AND: [
            ...((modelClauseWhere.AND as Prisma.ShopCatalogProjectionClauseWhereInput[]) ?? []),
            {
              OR: [
                { constraints: { some: { dimension: "CHASSIS", state: "EXACT", textValue: { equals: input.chassis, mode: "insensitive" } } } },
                { constraints: { some: { dimension: "GENERATION", state: "EXACT", textValue: { equals: input.chassis, mode: "insensitive" } } } },
              ],
            },
          ],
        }
      : modelClauseWhere;
    const [engines, ranges] = await Promise.all([
      exactValues("ENGINE", detailClauseWhere),
      prisma.shopCatalogProjectionConstraint.findMany({
        where: { dimension: "YEAR", state: "EXACT", clause: detailClauseWhere },
        distinct: ["yearFrom", "yearTo"],
        select: { yearFrom: true, yearTo: true },
      }),
    ]);
    const maxYear = new Date().getFullYear() + 2;
    const years = new Set<number>();
    for (const range of ranges) {
      const from = Math.max(1886, range.yearFrom ?? 1886);
      const to = Math.min(maxYear, range.yearTo ?? maxYear);
      for (let year = from; year <= to; year += 1) years.add(year);
    }
    return {
      type: "details" as const,
      make: input.make,
      model: input.model,
      chassis: input.chassis,
      data: {
        years: [...years].sort((left, right) => right - left),
        engines,
      },
    };
  }

  if (input.chassis) {
    const chassisClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
      ...modelClauseWhere,
      AND: [
        ...((modelClauseWhere.AND as Prisma.ShopCatalogProjectionClauseWhereInput[]) ?? []),
        {
          OR: [
            { constraints: { some: { dimension: "CHASSIS", state: "EXACT", textValue: { equals: input.chassis, mode: "insensitive" } } } },
            { constraints: { some: { dimension: "GENERATION", state: "EXACT", textValue: { equals: input.chassis, mode: "insensitive" } } } },
          ],
        },
      ],
    };
    const rows = await exactValues("ENGINE", chassisClauseWhere);
    return {
      type: "engines" as const,
      make: input.make,
      model: input.model,
      chassis: input.chassis,
      data: rows,
    };
  }

  const rows = [
    ...(await exactValues("CHASSIS", modelClauseWhere)),
    ...(await exactValues("GENERATION", modelClauseWhere)),
  ];
  return {
    type: "chassis" as const,
    make: input.make,
    model: input.model,
    data: [...new Set(rows)].sort((a, b) => a.localeCompare(b)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const chassis = searchParams.get("chassis");
    const brand = searchParams.get("brand")?.trim() || null;
    const details = searchParams.get("details") === "1";
    const vehicleScope = parseShopStockVehicleScope(searchParams.get("scope"));

    const canonical = await getCanonicalFitmentOptions({
      make,
      model,
      chassis,
      brand,
      scope: vehicleScope,
      details,
    });
    if (canonical) return cachedJson(canonical);

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
            fitment.models.some((candidate: string) => shopVehicleModelsMatch(candidate, model)) &&
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
              modelsSet.add(modelVal);
            }
          }
        }
      }
      let models = canonicalizeVehicleModels(make, Array.from(modelsSet));
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
              chassisSet.add(code);
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
