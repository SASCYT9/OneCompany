import "server-only";

import { Prisma } from "@prisma/client";

import { finalizeShopAiPlan } from "@/lib/shopAiAssistantPlanner";
import type {
  ShopAiContext,
  ShopAiPlan,
  ShopAiVehicleResolution,
} from "@/lib/shopAiAssistantTypes";
import { prisma } from "@/lib/prisma";
import { normalizeShopSearchText } from "@/lib/shopSearch";

type CanonicalVehicleRow = {
  make: string;
  model: string;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};

function isKnowledgeSchemaUnavailable(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2010" ||
    code === "P2021" ||
    code === "42P01" ||
    code === "42703" ||
    /VehicleGeneration|VehicleAlias|does not exist/i.test(message)
  );
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function resolveShopAiVehiclePlanFromKnowledge(
  plan: ShopAiPlan,
  context: ShopAiContext
): Promise<{ available: boolean; plan: ShopAiPlan }> {
  const make = plan.vehicle.make?.trim() || null;
  const model = plan.vehicle.model?.trim() || null;
  const chassis = plan.vehicle.chassis?.trim() || null;
  if (!make && !model && !chassis) return { available: true, plan };

  const aliasQuery = normalizeShopSearchText([make, model, chassis].filter(Boolean).join(" "));
  try {
    const rows = await prisma.$queryRaw<CanonicalVehicleRow[]>(Prisma.sql`
      SELECT DISTINCT
        generation."make",
        generation."model",
        generation."chassisCode",
        generation."yearFrom",
        generation."yearTo"
      FROM "VehicleGeneration" generation
      LEFT JOIN "VehicleAlias" alias
        ON alias."vehicleGenerationId" = generation."id"
        AND alias."isActive" = true
      WHERE generation."isActive" = true
        ${context.scope ? Prisma.sql`AND generation."scope" = ${context.scope}` : Prisma.empty}
        ${
          make
            ? Prisma.sql`AND lower(trim(generation."make")) = lower(trim(${make}))`
            : Prisma.empty
        }
        ${
          model
            ? Prisma.sql`AND lower(trim(generation."model")) = lower(trim(${model}))`
            : Prisma.empty
        }
        ${
          chassis
            ? Prisma.sql`
                AND (
                  lower(trim(COALESCE(generation."chassisCode", ''))) = lower(trim(${chassis}))
                  OR alias."normalizedAlias" = ${normalizeShopSearchText(chassis)}
                )
              `
            : Prisma.empty
        }
        ${
          !make && !model && !chassis && aliasQuery
            ? Prisma.sql`AND alias."normalizedAlias" = ${aliasQuery}`
            : Prisma.empty
        }
        ${
          plan.vehicle.year
            ? Prisma.sql`
                AND (generation."yearFrom" IS NULL OR generation."yearFrom" <= ${plan.vehicle.year})
                AND (generation."yearTo" IS NULL OR generation."yearTo" >= ${plan.vehicle.year})
              `
            : Prisma.empty
        }
      ORDER BY generation."yearFrom" DESC NULLS LAST
      LIMIT 8
    `);

    if (!rows.length) {
      return {
        available: true,
        plan: finalizeShopAiPlan(
          {
            ...plan,
            vehicleResolution: {
              status: "incomplete",
              confidence: "low",
              source: "unresolved",
              candidates: [],
              reason: "canonical-vehicle-not-found",
            },
          },
          context
        ),
      };
    }

    const candidateChassis = unique(rows.map((row) => row.chassisCode));
    const resolvedRow = rows.length === 1 || candidateChassis.length === 1 ? rows[0] : null;
    const resolution: ShopAiVehicleResolution = resolvedRow
      ? {
          status: "resolved",
          confidence: plan.vehicle.year || chassis ? "high" : "medium",
          source: chassis ? "explicit" : "catalog",
          candidates: resolvedRow.chassisCode ? [resolvedRow.chassisCode] : [],
          reason: plan.vehicle.year
            ? "canonical-generation-by-year"
            : chassis
              ? "canonical-generation-by-chassis"
              : "canonical-generation",
        }
      : {
          status: "ambiguous",
          confidence: "low",
          source: "catalog",
          candidates: candidateChassis,
          reason: "multiple-canonical-generations",
        };

    return {
      available: true,
      plan: finalizeShopAiPlan(
        {
          ...plan,
          vehicle: resolvedRow
            ? {
                ...plan.vehicle,
                make: resolvedRow.make,
                model: resolvedRow.model,
                chassis: plan.vehicle.chassis ?? resolvedRow.chassisCode,
              }
            : plan.vehicle,
          vehicleResolution: resolution,
        },
        context
      ),
    };
  } catch (error) {
    if (!isKnowledgeSchemaUnavailable(error)) throw error;
    return { available: false, plan };
  }
}
