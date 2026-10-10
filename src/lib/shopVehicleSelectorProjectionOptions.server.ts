import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SHOP_CATALOG_PROJECTION_SCHEMA_VERSION } from "@/lib/shopCatalogProjection.server";
import {
  vehicleChassisKey,
  vehicleChassisSelfAndAncestors,
  vehicleModelFamilyBases,
  vehicleModelScope,
} from "@/lib/shopVehicleHierarchy";
import {
  canonicalVehicleMakeLabel,
  vehicleMakeAliases,
  vehicleModelAliases,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

const ROW_LIMIT = 20_000;

export type ProjectionVehicleChassisOptions = { codes: string[]; counts: Record<string, number> };

/**
 * Chassis/generation options of a model, read from the verified projection
 * clauses with the listing's own hierarchy: a base model also owns its trims
 * (`911` -> `911 GT3`) and a facelift makes its generation selectable too
 * (`992.1` -> `992`). `counts` is the number of products each option returns.
 */
export async function listProjectionVehicleChassisOptions(
  input: { make: string; model: string; scope?: "auto" | "moto" | null },
  client: Pick<typeof prisma, "$queryRaw"> = prisma
): Promise<ProjectionVehicleChassisOptions | null> {
  const make = canonicalVehicleMakeLabel(input.make);
  const makeKeys = vehicleMakeAliases(make).map((value) => value.toLowerCase());
  const modelKeys = [
    ...new Set(
      vehicleModelScope(make, input.model)
        .exact.flatMap((model) => vehicleModelAliases(make, model))
        .map(vehicleModelKey)
    ),
  ];
  if (!makeKeys.length || !modelKeys.length) return null;
  const correlated = (dimension: "MAKE" | "MODEL", predicate: Prisma.Sql) => Prisma.sql`
    EXISTS (
      SELECT 1 FROM "ShopCatalogProjectionConstraint" selected_constraint
      WHERE selected_constraint."targetKey" = clause."targetKey"
        AND selected_constraint."clauseKey" = clause."clauseKey"
        AND selected_constraint."productId" = clause."productId"
        AND selected_constraint."sourceVersion" = clause."sourceVersion"
        AND selected_constraint."dimension" = ${dimension}::"ShopCatalogCompatibilityDimension"
        AND (selected_constraint."state" IN ('ANY', 'NOT_APPLICABLE')
          OR (selected_constraint."state" = 'EXACT' AND ${predicate}))
      OFFSET 0
    )`;
  const rows = await client.$queryRaw<Array<{ productId: string; code: string }>>(Prisma.sql`
    SELECT DISTINCT clause."productId" AS "productId", option_constraint."textValue" AS code
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
    JOIN "ShopCatalogProjection" projection
      ON projection."productId" = clause."productId"
     AND projection."sourceVersion" = clause."sourceVersion"
     AND projection."schemaVersion" = ${SHOP_CATALOG_PROJECTION_SCHEMA_VERSION}
     AND projection."locale" = 'en'
     AND projection."isPublished" = true
     AND projection."statusKey" = 'ACTIVE'
    WHERE option_constraint."dimension" IN ('GENERATION', 'CHASSIS')
      AND option_constraint."state" = 'EXACT'
      AND option_constraint."textValue" IS NOT NULL
      AND policy."mode" = 'VEHICLE_SPECIFIC'
      AND clause."verification" = 'VERIFIED'
      ${
        // Moto is a partition; auto is the unpartitioned catalog minus moto.
        input.scope === "moto"
          ? Prisma.sql`AND projection."scopeKey" = 'moto'`
          : Prisma.sql`AND projection."scopeKey" IS DISTINCT FROM 'moto'`
      }
      AND ${correlated("MAKE", Prisma.sql`lower(selected_constraint."textValue") IN (${Prisma.join(makeKeys)})`)}
      AND ${correlated("MODEL", Prisma.sql`regexp_replace(translate(lower(selected_constraint."textValue"), 'áàâäãåéèêëíìîïóòôöõúùûüýÿçñ', 'aaaaaaeeeeiiiiooooouuuuyycn'), '[^a-z0-9]+', '', 'g') IN (${Prisma.join(modelKeys)})`)}
    LIMIT ${ROW_LIMIT}
  `);
  if (!rows.length || rows.length >= ROW_LIMIT) return null;

  const labels = new Map<string, string>();
  const productsByOption = new Map<string, Set<string>>();
  for (const { productId, code } of rows) {
    for (const option of vehicleChassisSelfAndAncestors(code.trim())) {
      const key = vehicleChassisKey(option);
      if (!key) continue;
      if (!labels.has(key)) labels.set(key, option);
      const set = productsByOption.get(key) ?? new Set<string>();
      set.add(productId);
      productsByOption.set(key, set);
    }
  }
  const codes = [...labels.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
    .map(([, label]) => label);
  return {
    codes,
    counts: Object.fromEntries(
      [...labels.entries()].map(([key, label]) => [label, productsByOption.get(key)?.size ?? 0])
    ),
  };
}

/**
 * A trim is offered together with its base model (`911 GT3` -> `911`): the
 * base selection includes every trim, so it is never an empty option.
 */
export function withModelFamilyBases(make: string, models: readonly string[]) {
  const seen = new Set(models.map(vehicleModelKey));
  const result = [...models];
  for (const model of models) {
    for (const base of vehicleModelFamilyBases(make, model)) {
      if (seen.has(vehicleModelKey(base))) continue;
      seen.add(vehicleModelKey(base));
      result.push(base);
    }
  }
  return result;
}
