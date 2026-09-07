import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import { isVehicleMakeCompatibleWithScope } from "@/lib/shopStockVehicleScope";
import { readShopCatalogSelectorArtifactReadiness } from "@/lib/shopCatalogSelectorArtifact.server";
import {
  canonicalizeVehicleMakes,
  canonicalizeVehicleChassisCodes,
  canonicalizeVehicleModels,
  canonicalVehicleMakeLabel,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

export async function getCanonicalFitmentOptions(input: {
  make: string | null;
  model: string | null;
  chassis: string | null;
  year: number | null;
  brand: string | null;
  scope: "auto" | "moto" | null;
  details: boolean;
}) {
  if (isLocalStorefrontMode()) return null;
  // A non-empty projection is not proof that every source was published. The
  // readiness check is cached/single-flight and fails closed until the active
  // release marker, rebuild checkpoint, locale rows, and policy constraints all
  // describe one complete projection.
  const readiness = await readShopCatalogSelectorArtifactReadiness();
  if (!readiness.ready) return null;
  // Projection rows are not evidence of a complete selector artifact.  Keep
  // the existing bounded legacy fallback until the publisher has completed a
  // release and the persisted coverage gate agrees with its version.
  const readiness = await readShopCatalogSelectorArtifactReadiness();
  if (!readiness.ready) return null;
  const withSelectedYear = (
    where: Prisma.ShopCatalogProjectionClauseWhereInput
  ): Prisma.ShopCatalogProjectionClauseWhereInput =>
    input.year == null
      ? where
      : {
          AND: [
            where,
            {
              constraints: {
                some: {
                  dimension: "YEAR",
                  OR: [
                    { state: { in: ["ANY", "NOT_APPLICABLE"] } },
                    {
                      state: "EXACT",
                      AND: [
                        { OR: [{ yearFrom: null }, { yearFrom: { lte: input.year } }] },
                        { OR: [{ yearTo: null }, { yearTo: { gte: input.year } }] },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        };
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
    const rows = await prisma.shopCatalogProjectionConstraint.groupBy({
      by: ["textValue"],
      where: {
        dimension,
        state: "EXACT",
        textValue: { not: null },
        clause: where,
      },
      orderBy: { textValue: "asc" },
    });
    const values = rows
      .map((row) => row.textValue)
      .filter((value): value is string => Boolean(value));
    return values;
  };

  if (!input.make) {
    const rows = await exactValues("MAKE", clauseWhere);
    if (!rows.length) return null;
    return {
      type: "makes" as const,
      data: canonicalizeVehicleMakes(
        rows.filter((value) => isVehicleMakeCompatibleWithScope(value, input.scope))
      ),
    };
  }

  const canonicalMake = canonicalVehicleMakeLabel(input.make);
  const makeAliases = vehicleMakeAliases(canonicalMake);

  const makeClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
    ...clauseWhere,
    AND: [
      ...(scopeClausePredicate ? [scopeClausePredicate] : []),
      {
        constraints: {
          some: {
            dimension: "MAKE",
            state: "EXACT",
            textValue: { in: makeAliases, mode: "insensitive" },
          },
        },
      },
    ],
  };

  if (!input.model) {
    const rows = await exactValues("MODEL", makeClauseWhere);
    if (!rows.length) return null;
    const data = canonicalizeVehicleModels(canonicalMake, rows);
    return { type: "models" as const, make: canonicalMake, data };
  }

  const modelRows = await exactValues("MODEL", makeClauseWhere);
  const requestedModelAliases = vehicleModelAliases(canonicalMake, input.model);
  const requestedModelKeys = new Set(requestedModelAliases.map(vehicleModelKey));
  const modelAliases = modelRows.filter((value) => requestedModelKeys.has(vehicleModelKey(value)));
  if (!modelAliases.length) modelAliases.push(input.model);

  const modelClauseWhere: Prisma.ShopCatalogProjectionClauseWhereInput = {
    ...clauseWhere,
    AND: [
      ...(scopeClausePredicate ? [scopeClausePredicate] : []),
      {
        constraints: {
          some: {
            dimension: "MAKE",
            state: "EXACT",
            textValue: { in: makeAliases, mode: "insensitive" },
          },
        },
      },
      {
        constraints: {
          some: {
            dimension: "MODEL",
            state: "EXACT",
            textValue: { in: modelAliases, mode: "insensitive" },
          },
        },
      },
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
                {
                  constraints: {
                    some: {
                      dimension: "CHASSIS",
                      state: "EXACT",
                      textValue: { equals: input.chassis, mode: "insensitive" },
                    },
                  },
                },
                {
                  constraints: {
                    some: {
                      dimension: "GENERATION",
                      state: "EXACT",
                      textValue: { equals: input.chassis, mode: "insensitive" },
                    },
                  },
                },
              ],
            },
          ],
        }
      : modelClauseWhere;
    const [engines, ranges] = await Promise.all([
      exactValues("ENGINE", withSelectedYear(detailClauseWhere)),
      prisma.shopCatalogProjectionConstraint.groupBy({
        by: ["yearFrom", "yearTo"],
        where: { dimension: "YEAR", state: "EXACT", clause: detailClauseWhere },
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
            {
              constraints: {
                some: {
                  dimension: "CHASSIS",
                  state: "EXACT",
                  textValue: { equals: input.chassis, mode: "insensitive" },
                },
              },
            },
            {
              constraints: {
                some: {
                  dimension: "GENERATION",
                  state: "EXACT",
                  textValue: { equals: input.chassis, mode: "insensitive" },
                },
              },
            },
          ],
        },
      ],
    };
    const rows = await exactValues("ENGINE", withSelectedYear(chassisClauseWhere));
    return {
      type: "engines" as const,
      make: input.make,
      model: input.model,
      chassis: input.chassis,
      data: rows,
    };
  }

  // Chassis and generation are independent dimensions. Run both bounded
  // GROUP BY reads together so the final selector level does not add a second
  // round-trip before returning options.
  const [chassisRows, generationRows] = await Promise.all([
    exactValues("CHASSIS", modelClauseWhere),
    exactValues("GENERATION", modelClauseWhere),
  ]);
  const rows = [...chassisRows, ...generationRows];
  return {
    type: "chassis" as const,
    make: input.make,
    model: input.model,
    data: canonicalizeVehicleChassisCodes(rows, canonicalMake, input.model),
  };
}
