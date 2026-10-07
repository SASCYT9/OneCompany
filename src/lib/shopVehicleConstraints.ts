import type { Fitment } from "@/lib/crossShopFitment";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import { vehicleChassisMatchLevel } from "@/lib/shopVehicleHierarchy";
import { vehicleYearRangeContains } from "@/lib/shopVehicleYears";
import {
  canonicalVehicleMakeLabel,
  canonicalVehicleModelLabel,
  vehicleModelAliases,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";

export type ShopVehicleConstraints = {
  make?: string | null;
  model?: string | null;
  modelAlternates?: readonly string[] | null;
  chassis?: string | null;
  /**
   * Also accept products filed on a broader code (`992` for a `992.1`
   * request). They are a lower tier, never an exact match.
   */
  chassisIncludesAncestors?: boolean;
  year?: number | null;
};

function normalizedMakeFamily(value: string | null | undefined) {
  return normalizeShopSearchText(canonicalVehicleMakeLabel(value ?? ""));
}

export function shopVehicleMakesMatch(
  candidate: string | null | undefined,
  requested: string | null | undefined
) {
  if (!requested) return true;
  if (!candidate) return false;
  return normalizedMakeFamily(candidate) === normalizedMakeFamily(requested);
}

export function shopVehicleModelsMatch(
  candidate: string,
  requested: string | null | undefined,
  make?: string | null
) {
  if (!requested) return true;
  if (make) {
    const requestedKeys = new Set(vehicleModelAliases(make, requested).map(vehicleModelKey));
    if (requestedKeys.has(vehicleModelKey(candidate))) return true;
  }
  return make
    ? vehicleModelKey(canonicalVehicleModelLabel(make, candidate)) ===
        vehicleModelKey(canonicalVehicleModelLabel(make, requested))
    : vehicleModelKey(candidate) === vehicleModelKey(requested);
}

/**
 * A selected chassis is a generation constraint. Platform siblings such as
 * MK7/MK8 or 8V/8Y must not be treated as interchangeable, and a generic 991
 * record cannot silently confirm an explicit 991.2 request. A request for the
 * generation itself (`992`) includes its facelifts (`992.1`, `992.2`); the
 * reverse is only accepted when the caller asks for the lower tier.
 */
export function shopVehicleChassisMatches(
  candidate: string,
  requested: string | null | undefined,
  options: { includeAncestors?: boolean } = {}
) {
  if (!requested) return true;
  const level = vehicleChassisMatchLevel(candidate, requested);
  return (
    level === "exact" ||
    level === "descendant" ||
    (options.includeAncestors === true && level === "ancestor")
  );
}

/** Known contradictions are rejected. Missing year evidence remains eligible
 * for the legacy transition and must later be labelled as requiring review. */
export function shopVehicleYearAllows(fitment: Pick<Fitment, "yearRanges">, year?: number | null) {
  if (!year) return true;
  if (fitment.yearRanges.length === 0) return true;
  return fitment.yearRanges.some((range) => vehicleYearRangeContains(range, year));
}

export function shopFitmentMatchesVehicleConstraints(
  fitment: Fitment,
  constraints: ShopVehicleConstraints
) {
  if (!shopVehicleMakesMatch(fitment.make, constraints.make)) return false;
  const requestedModels = [constraints.model, ...(constraints.modelAlternates ?? [])].filter(
    (model): model is string => Boolean(model?.trim())
  );
  if (
    requestedModels.length > 0 &&
    !fitment.models.some((candidate) =>
      requestedModels.some((requested) =>
        shopVehicleModelsMatch(candidate, requested, fitment.make)
      )
    )
  ) {
    return false;
  }
  if (
    constraints.chassis &&
    !fitment.chassisCodes.some((chassis) =>
      shopVehicleChassisMatches(chassis, constraints.chassis, {
        includeAncestors: constraints.chassisIncludesAncestors,
      })
    )
  ) {
    return false;
  }
  return shopVehicleYearAllows(fitment, constraints.year);
}
