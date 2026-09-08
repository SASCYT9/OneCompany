import "server-only";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import { shopVehicleModelsMatch } from "@/lib/shopVehicleConstraints";
import {
  splitVehicleChassisCodes,
  vehicleMakeAliases,
  vehicleModelAliases,
} from "@/lib/shopVehicleTaxonomy";
import type { ShopStockVehicleScope } from "@/lib/shopStockVehicleScope";

// Dynamic supplier labels are only an alias-enrichment step. Keep them in the
// warm function process so repeated searches do not rescan every projection
// constraint row. The canonical application/policy query remains authoritative
// and still runs for every request, so this cache cannot hide product edits.
const DYNAMIC_ALIAS_CACHE_TTL_MS = 5 * 60 * 1000;
const dynamicAliasCache = new Map<string, { values: string[]; expiresAt: number }>();
const dynamicAliasInflight = new Map<string, Promise<string[]>>();

function dynamicAliasKey(kind: "model" | "chassis", value: string, make = "") {
  return `${kind}:${make.trim().toLocaleLowerCase()}|${value.trim().toLocaleLowerCase()}`;
}

async function getDynamicModelAliases(make: string, value: string): Promise<string[]> {
  const key = dynamicAliasKey("model", value, make);
  const now = Date.now();
  const cached = dynamicAliasCache.get(key);
  if (cached && cached.expiresAt > now) return cached.values;
  const inflight = dynamicAliasInflight.get(key);
  if (inflight) return inflight;

  const promise = prisma.shopCatalogProjectionConstraint
    .findMany({
      where: {
        dimension: "MODEL",
        state: "EXACT",
        textValue: { not: null },
      },
      distinct: ["textValue"],
      select: { textValue: true },
    })
    .then((rows) =>
      rows
        .map((row) => row.textValue)
        .filter((candidate): candidate is string => {
          if (!candidate) return false;
          return shopVehicleModelsMatch(candidate, value, make);
        })
    );
  dynamicAliasInflight.set(key, promise);
  try {
    const values = await promise;
    dynamicAliasCache.set(key, { values, expiresAt: Date.now() + DYNAMIC_ALIAS_CACHE_TTL_MS });
    return values;
  } finally {
    if (dynamicAliasInflight.get(key) === promise) dynamicAliasInflight.delete(key);
  }
}

async function getDynamicChassisAliases(value: string): Promise<string[]> {
  const key = dynamicAliasKey("chassis", value);
  const now = Date.now();
  const cached = dynamicAliasCache.get(key);
  if (cached && cached.expiresAt > now) return cached.values;
  const inflight = dynamicAliasInflight.get(key);
  if (inflight) return inflight;

  const promise = prisma.shopCatalogProjectionConstraint
    .findMany({
      where: {
        dimension: { in: ["GENERATION", "CHASSIS"] },
        state: "EXACT",
        textValue: { contains: value, mode: "insensitive" },
      },
      distinct: ["textValue"],
      select: { textValue: true },
    })
    .then((rows) =>
      rows
        .map((row) => row.textValue)
        .filter((candidate): candidate is string => {
          if (!candidate) return false;
          return splitVehicleChassisCodes(candidate).some(
            (code) => code.toLocaleLowerCase() === value.toLocaleLowerCase()
          );
        })
    );
  dynamicAliasInflight.set(key, promise);
  try {
    const values = await promise;
    dynamicAliasCache.set(key, { values, expiresAt: Date.now() + DYNAMIC_ALIAS_CACHE_TTL_MS });
    return values;
  } finally {
    if (dynamicAliasInflight.get(key) === promise) dynamicAliasInflight.delete(key);
  }
}

export function isMissingStrictCatalogSchema(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2021" ||
    code === "P2010" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopProductKnowledge|ShopVehicleApplication|column .* does not exist|does not exist/i.test(
      message
    )
  );
}

export async function resolveCanonicalVehicleProductIds(input: {
  make: string;
  model: string;
  chassis: string;
  year: number | null;
  engine: string | null;
  fuel: string | null;
  opfGpf: string | null;
  scope: ShopStockVehicleScope | null;
}): Promise<string[] | null> {
  if (
    !input.make &&
    !input.model &&
    !input.chassis &&
    !input.year &&
    !input.engine &&
    !input.fuel &&
    !input.opfGpf
  ) {
    return null;
  }
  if (isLocalStorefrontMode()) return null;
  try {
    const exactTextConstraint = (
      dimension:
        "SCOPE" | "MAKE" | "MODEL" | "GENERATION" | "CHASSIS" | "ENGINE" | "FUEL" | "OPF_GPF",
      value: string
    ) => ({
      dimension,
      state: "EXACT" as const,
      textValue: {
        in: dimension === "MAKE" ? vehicleMakeAliases(value) : [value],
        mode: "insensitive" as const,
      },
    });
    // Model and chassis alias discovery is independent; overlap both scans so
    // a cold request pays the slower query once instead of their sum.
    const [dynamicModelAliases, dynamicChassisAliases] = await Promise.all([
      input.model ? getDynamicModelAliases(input.make, input.model) : Promise.resolve<string[]>([]),
      input.chassis ? getDynamicChassisAliases(input.chassis) : Promise.resolve<string[]>([]),
    ]);
    const modelAliases = input.model
      ? [...vehicleModelAliases(input.make, input.model), ...dynamicModelAliases]
      : [];
    const uniqueModelAliases = [...new Set(modelAliases)];
    const chassisAliases = input.chassis ? [input.chassis, ...dynamicChassisAliases] : [];
    const uniqueChassisAliases = [...new Set(chassisAliases)];
    const canonicalClauseConstraints = [
      ...(input.scope ? [exactTextConstraint("SCOPE", input.scope)] : []),
      ...(input.make ? [exactTextConstraint("MAKE", input.make)] : []),
      ...(input.model
        ? [
            {
              dimension: "MODEL" as const,
              state: "EXACT" as const,
              textValue: { in: uniqueModelAliases, mode: "insensitive" as const },
            },
          ]
        : []),
      ...(input.chassis
        ? [
            {
              OR: [
                {
                  dimension: "GENERATION" as const,
                  state: "EXACT" as const,
                  textValue: { in: uniqueChassisAliases, mode: "insensitive" as const },
                },
                {
                  dimension: "CHASSIS" as const,
                  state: "EXACT" as const,
                  textValue: { in: uniqueChassisAliases, mode: "insensitive" as const },
                },
              ],
            },
          ]
        : []),
      ...(input.engine ? [exactTextConstraint("ENGINE", input.engine)] : []),
      ...(input.fuel ? [exactTextConstraint("FUEL", input.fuel)] : []),
      ...(input.opfGpf ? [exactTextConstraint("OPF_GPF", input.opfGpf)] : []),
      ...(input.year
        ? [
            {
              dimension: "YEAR" as const,
              state: "EXACT" as const,
              AND: [
                { OR: [{ yearFrom: null }, { yearFrom: { lte: input.year } }] },
                { OR: [{ yearTo: null }, { yearTo: { gte: input.year } }] },
              ],
            },
          ]
        : []),
    ];
    const readApplicationRows = async () =>
      await prisma.shopVehicleApplication.findMany({
        where: {
          isActive: true,
          isUniversal: false,
          verificationStatus: { not: "BLOCKED" },
          ...(input.scope ? { scope: input.scope } : {}),
          ...(input.make
            ? { make: { in: vehicleMakeAliases(input.make), mode: "insensitive" } }
            : {}),
          ...(input.model ? { model: { in: uniqueModelAliases, mode: "insensitive" } } : {}),
          ...(input.chassis
            ? { chassisCode: { in: uniqueChassisAliases, mode: "insensitive" } }
            : {}),
          ...(input.engine ? { engine: { equals: input.engine, mode: "insensitive" } } : {}),
          ...(input.fuel ? { fuel: { equals: input.fuel, mode: "insensitive" } } : {}),
          ...(input.opfGpf ? { opfGpf: input.opfGpf } : {}),
          ...(input.year
            ? {
                AND: [
                  { OR: [{ yearFrom: null }, { yearFrom: { lte: input.year } }] },
                  { OR: [{ yearTo: null }, { yearTo: { gte: input.year } }] },
                ],
              }
            : {}),
          product: { isPublished: true, status: "ACTIVE" },
        },
        distinct: ["productId"],
        select: { productId: true },
      });
    const readPolicyRows = async () =>
      await prisma.shopCatalogProjectionClause.findMany({
        where: {
          policy: { mode: { not: "UNIVERSAL" } },
          product: { isPublished: true, status: "ACTIVE" },
          AND: canonicalClauseConstraints.map((constraint) => ({
            constraints: { some: constraint },
          })),
        },
        distinct: ["productId"],
        select: { productId: true },
      });
    const [applicationRows, policyRows] = await Promise.all([
      readApplicationRows(),
      readPolicyRows(),
    ]);
    return [...new Set([...applicationRows, ...policyRows].map((row) => row.productId))];
  } catch (error) {
    if (isMissingStrictCatalogSchema(error)) return null;
    throw error;
  }
}
