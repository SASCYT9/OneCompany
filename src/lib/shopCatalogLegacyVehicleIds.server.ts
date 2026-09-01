import "server-only";

import { extractProductFitment } from "@/lib/crossShopFitment";
import { getShopFitmentCatalogProducts } from "@/lib/shopFitmentCatalogServer";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import { prisma } from "@/lib/prisma";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import { vehicleModelKey } from "@/lib/shopVehicleTaxonomy";

type LegacyVehicleQuery = {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  year?: number | null;
};

let cachedProducts: Awaited<ReturnType<typeof getShopFitmentCatalogProducts>> | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60_000;

async function getCachedFitmentProducts() {
  if (cachedProducts && Date.now() - cachedAt < CACHE_MS) return cachedProducts;
  cachedProducts = await getShopFitmentCatalogProducts();
  cachedAt = Date.now();
  return cachedProducts;
}

/**
 * Transitional compatibility bridge. Legacy product-owned fitment evidence has
 * broader coverage than the new policy projection, so use it only to resolve
 * product IDs. Cards, prices, media and pagination still come from the bounded
 * catalog projection.
 */
export async function resolveLegacyVehicleProductIds(input: LegacyVehicleQuery) {
  if (!input.make && !input.model && !input.generation && !input.year) return null;
  const [products, canonicalApplications] = await Promise.all([
    getCachedFitmentProducts(),
    input.make
      ? prisma.shopVehicleApplication.findMany({
          where: {
            isActive: true,
            isUniversal: false,
            verificationStatus: { not: "BLOCKED" },
            make: { equals: input.make, mode: "insensitive" },
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
  ]);
  const ids = new Set(
    products
      .filter((product) => {
        return shopFitmentMatchesVehicleConstraints(extractProductFitment(product), {
          make: input.make,
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
  return [...ids];
}
