import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import { isVehicleMakeCompatibleWithScope } from "@/lib/shopStockVehicleScope";
import { readShopCatalogSelectorArtifactReadiness } from "@/lib/shopCatalogSelectorArtifact.server";
import { SHOP_CATALOG_PROJECTION_SCHEMA_VERSION } from "@/lib/shopCatalogProjection.server";
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
  if (!readiness.ready) {
    return getBoundedPublishedFitmentOptions(input);
  }
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

const BOUNDED_SELECTOR_VALUE_LIMIT = 2_001;

/**
 * Serves a selector slice while the global publication marker is unavailable.
 * Every returned value still comes from a current, published projection target
 * with a VERIFIED clause. UNKNOWN dimensions are naturally excluded from exact
 * option reads; the response remains explicitly partial. The extra row lets us
 * detect overflow and fail closed instead of returning a misleading prefix.
 */
export async function getBoundedPublishedFitmentOptions(
  input: {
    make: string | null;
    model: string | null;
    chassis: string | null;
    year: number | null;
    brand: string | null;
    scope: "auto" | "moto" | null;
    details: boolean;
  },
  client: Pick<typeof prisma, "$queryRaw"> = prisma
) {
  const meta = {
    source: "catalog_v2_current_product_projection" as const,
    coverage: "partial" as const,
    complete: false as const,
  };
  const brandPredicate = input.brand
    ? Prisma.sql`AND (lower(product."brand") = lower(${input.brand}) OR lower(product."vendor") = lower(${input.brand}))`
    : Prisma.empty;
  const scopePredicate = input.scope
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "ShopCatalogProjectionConstraint" scope_constraint
        WHERE scope_constraint."targetKey" = clause."targetKey"
          AND scope_constraint."clauseKey" = clause."clauseKey"
          AND scope_constraint."productId" = clause."productId"
          AND scope_constraint."sourceVersion" = clause."sourceVersion"
          AND scope_constraint."dimension" = 'SCOPE'
          AND scope_constraint."state" = 'EXACT'
          AND lower(scope_constraint."textValue") = lower(${input.scope})
      )`
    : Prisma.empty;
  const currentClause = (extra: Prisma.Sql = Prisma.empty) => Prisma.sql`
    FROM "ShopCatalogProjectionConstraint" option_constraint
    JOIN "ShopCatalogProjectionClause" clause
      ON clause."targetKey" = option_constraint."targetKey"
     AND clause."clauseKey" = option_constraint."clauseKey"
     AND clause."productId" = option_constraint."productId"
     AND clause."sourceVersion" = option_constraint."sourceVersion"
    JOIN "ShopCatalogProjectionPolicy" policy
      ON policy."targetKey" = clause."targetKey"
     AND policy."productId" = clause."productId"
     AND policy."sourceVersion" = clause."sourceVersion"
    JOIN "ShopProduct" product ON product."id" = clause."productId"
    JOIN "ShopCatalogProjection" projection
      ON projection."productId" = clause."productId"
     AND projection."schemaVersion" = ${SHOP_CATALOG_PROJECTION_SCHEMA_VERSION}
     AND projection."catalogVersion" = product."catalogVersion"
     AND projection."locale" = 'en'
     AND projection."isPublished" = true
     AND projection."statusKey" = 'ACTIVE'
    WHERE option_constraint."sourceVersion" = policy."sourceVersion"
      AND policy."sourceVersion" = projection."sourceVersion"
      AND clause."verification" = 'VERIFIED'
      AND option_constraint."state" = 'EXACT'
      AND product."isPublished" = true
      AND product."status" = 'ACTIVE'
      ${brandPredicate}
      ${scopePredicate}
      ${extra}
  `;
  const exactValues = async (
    dimension: "MAKE" | "MODEL" | "CHASSIS" | "GENERATION" | "ENGINE",
    extra = Prisma.empty
  ) => {
    const rows = await client.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
      SELECT option_constraint."textValue" AS value
      ${currentClause(Prisma.sql`AND option_constraint."dimension" = ${dimension} ${extra}`)}
      GROUP BY option_constraint."textValue"
      ORDER BY option_constraint."textValue" ASC
      LIMIT ${BOUNDED_SELECTOR_VALUE_LIMIT}
    `);
    if (rows.length >= BOUNDED_SELECTOR_VALUE_LIMIT) return null;
    return rows.map((row) => row.value).filter((value): value is string => Boolean(value?.trim()));
  };
  const make = input.make;
  if (!make) {
    const rows = await exactValues("MAKE");
    if (!rows) return null;
    const data = canonicalizeVehicleMakes(
      rows.filter((value) => isVehicleMakeCompatibleWithScope(value, input.scope))
    );
    return data.length ? { type: "makes" as const, data, meta } : null;
  }
  const canonicalMake = canonicalVehicleMakeLabel(make);
  const makeAliases = vehicleMakeAliases(canonicalMake);
  const makeFilter = Prisma.sql`AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionConstraint" make_constraint
    WHERE make_constraint."targetKey" = clause."targetKey"
      AND make_constraint."clauseKey" = clause."clauseKey"
      AND make_constraint."productId" = clause."productId"
      AND make_constraint."sourceVersion" = clause."sourceVersion"
      AND make_constraint."dimension" = 'MAKE'
      AND make_constraint."state" = 'EXACT'
      AND lower(make_constraint."textValue") IN (${Prisma.join(makeAliases.map((value) => Prisma.sql`${value.toLowerCase()}`))})
  )`;
  if (!input.model) {
    const rows = await exactValues("MODEL", makeFilter);
    return rows
      ? {
          type: "models" as const,
          make: canonicalMake,
          data: canonicalizeVehicleModels(canonicalMake, rows),
          meta,
        }
      : null;
  }
  const modelAliases = vehicleModelAliases(canonicalMake, input.model);
  const modelFilter = Prisma.sql`AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionConstraint" model_constraint
    WHERE model_constraint."targetKey" = clause."targetKey"
      AND model_constraint."clauseKey" = clause."clauseKey"
      AND model_constraint."productId" = clause."productId"
      AND model_constraint."sourceVersion" = clause."sourceVersion"
      AND model_constraint."dimension" = 'MODEL'
      AND model_constraint."state" = 'EXACT'
      AND lower(model_constraint."textValue") IN (${Prisma.join(modelAliases.map((value) => Prisma.sql`${value.toLowerCase()}`))})
  )`;
  const selected = Prisma.sql`${makeFilter} ${modelFilter}`;
  const yearFilter =
    input.year == null
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionConstraint" year_constraint
    WHERE year_constraint."targetKey" = clause."targetKey" AND year_constraint."clauseKey" = clause."clauseKey"
      AND year_constraint."productId" = clause."productId" AND year_constraint."sourceVersion" = clause."sourceVersion"
      AND year_constraint."dimension" = 'YEAR'
      AND (year_constraint."state" IN ('ANY', 'NOT_APPLICABLE') OR
        (year_constraint."state" = 'EXACT' AND (year_constraint."yearFrom" IS NULL OR year_constraint."yearFrom" <= ${input.year})
          AND (year_constraint."yearTo" IS NULL OR year_constraint."yearTo" >= ${input.year})))
  )`;
  if (input.details) {
    const chassisFilter = input.chassis
      ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM "ShopCatalogProjectionConstraint" chassis_constraint
      WHERE chassis_constraint."targetKey" = clause."targetKey" AND chassis_constraint."clauseKey" = clause."clauseKey"
        AND chassis_constraint."productId" = clause."productId" AND chassis_constraint."sourceVersion" = clause."sourceVersion"
        AND chassis_constraint."dimension" IN ('CHASSIS', 'GENERATION') AND chassis_constraint."state" = 'EXACT'
        AND lower(chassis_constraint."textValue") = lower(${input.chassis})
    )`
      : Prisma.empty;
    const engines = await exactValues(
      "ENGINE",
      Prisma.sql`${selected} ${chassisFilter} ${yearFilter}`
    );
    if (!engines) return null;
    const ranges = await client.$queryRaw<
      Array<{ yearFrom: number | null; yearTo: number | null }>
    >(Prisma.sql`
      SELECT option_constraint."yearFrom" AS "yearFrom", option_constraint."yearTo" AS "yearTo"
      ${currentClause(Prisma.sql`AND option_constraint."dimension" = 'YEAR' ${selected} ${chassisFilter}`)}
      GROUP BY option_constraint."yearFrom", option_constraint."yearTo"
      LIMIT ${BOUNDED_SELECTOR_VALUE_LIMIT}
    `);
    if (ranges.length >= BOUNDED_SELECTOR_VALUE_LIMIT) return null;
    const years = new Set<number>();
    const maxYear = new Date().getFullYear() + 2;
    for (const range of ranges)
      for (
        let year = Math.max(1886, range.yearFrom ?? 1886);
        year <= Math.min(maxYear, range.yearTo ?? maxYear);
        year += 1
      )
        years.add(year);
    return {
      type: "details" as const,
      make,
      model: input.model,
      chassis: input.chassis,
      data: { years: [...years].sort((a, b) => b - a), engines },
      meta,
    };
  }
  if (input.chassis) {
    const chassisFilter = Prisma.sql`AND EXISTS (SELECT 1 FROM "ShopCatalogProjectionConstraint" c WHERE c."targetKey" = clause."targetKey" AND c."clauseKey" = clause."clauseKey" AND c."productId" = clause."productId" AND c."sourceVersion" = clause."sourceVersion" AND c."dimension" IN ('CHASSIS', 'GENERATION') AND c."state" = 'EXACT' AND lower(c."textValue") = lower(${input.chassis}))`;
    const rows = await exactValues(
      "ENGINE",
      Prisma.sql`${selected} ${chassisFilter} ${yearFilter}`
    );
    return rows
      ? {
          type: "engines" as const,
          make,
          model: input.model,
          chassis: input.chassis,
          data: rows,
          meta,
        }
      : null;
  }
  const [chassisRows, generationRows] = await Promise.all([
    exactValues("CHASSIS", selected),
    exactValues("GENERATION", selected),
  ]);
  if (!chassisRows || !generationRows) return null;
  return {
    type: "chassis" as const,
    make,
    model: input.model,
    data: canonicalizeVehicleChassisCodes(
      [...chassisRows, ...generationRows],
      canonicalMake,
      input.model
    ),
    meta,
  };
}
