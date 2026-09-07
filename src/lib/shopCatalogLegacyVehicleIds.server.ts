import "server-only";

import { singleFlight } from "@/lib/singleFlight";
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

let cachedProducts: Array<{
  id: string | undefined;
  fitment: ReturnType<typeof extractProductFitment>;
}> | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60_000;

const getCachedFitmentProducts = singleFlight(async () => {
  if (cachedProducts && Date.now() - cachedAt < CACHE_MS) return cachedProducts;
  const products = await getShopFitmentCatalogProducts();
  cachedProducts = products.map((product) => ({
    id: product.id,
    fitment: extractProductFitment(product),
  }));
  cachedAt = Date.now();
  return cachedProducts;
});

/**
 * Transitional compatibility bridge. Legacy product-owned fitment evidence has
 * broader coverage than the new policy projection, so use it only to resolve
 * product IDs. Cards, prices, media and pagination still come from the bounded
 * catalog projection.
 */
export async function resolveLegacyVehicleProductIds(input: LegacyVehicleQuery) {
  if (!input.make && !input.model && !input.generation && !input.year) return null;
  const canonicalMake = canonicalVehicleMakeLabel(input.make ?? "");
  const makeAliases = input.make ? vehicleMakeAliases(canonicalMake) : [];
  const [products, canonicalApplications, projectionClauses] = await Promise.all([
    getCachedFitmentProducts(),
    input.make
      ? prisma.shopVehicleApplication.findMany({
          where: {
            isActive: true,
            isUniversal: false,
            verificationStatus: { not: "BLOCKED" },
            make: { in: makeAliases, mode: "insensitive" },
            product: { isPublished: true, status: "ACTIVE" },
          },
          select: {
            productId: true,
            model: true,
            chassisCode: true,
            yearFrom: true,
            yearTo: true,
          },
        })
      : Promise.resolve([]),
    input.make
      ? prisma.shopCatalogProjectionClause.findMany({
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
          },
          select: {
            productId: true,
            constraints: {
              select: {
                dimension: true,
                state: true,
                textValue: true,
                yearFrom: true,
                yearTo: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
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
