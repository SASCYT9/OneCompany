import { isExpectedChassisForMakeModel } from "@/lib/crossShopFitment";
import { finalizeShopAiPlan } from "@/lib/shopAiAssistantPlanner";
import type {
  ShopAiContext,
  ShopAiPlan,
  ShopAiVehicleResolution,
} from "@/lib/shopAiAssistantTypes";
import { enrichVehicleSearchFromCatalog, expandVehicleAliases } from "@/lib/shopVehicleSearch";

type CatalogVehicleItem = {
  titleText: string;
  fitment: {
    make: string | null;
    models: string[];
    chassisCodes: string[];
    yearRanges?: Array<{ from: number; to: number | null }>;
  };
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function sameVehicleValue(left: string | null | undefined, right: string | null | undefined) {
  return left?.trim().toLocaleLowerCase("en-US") === right?.trim().toLocaleLowerCase("en-US");
}

/**
 * Resolves canonical vehicle identity from catalog-owned fitment evidence.
 * The language model may extract words, but it does not get to decide a
 * generation or compatibility boundary.
 */
export function resolveShopAiVehiclePlan(
  plan: ShopAiPlan,
  context: ShopAiContext,
  catalog: CatalogVehicleItem[]
): ShopAiPlan {
  const vehicleQuery = [
    plan.vehicle.make,
    plan.vehicle.model,
    plan.vehicle.chassis,
    plan.vehicle.year,
    plan.searchQuery,
  ]
    .filter(Boolean)
    .join(" ");
  const resolved = enrichVehicleSearchFromCatalog(expandVehicleAliases(vehicleQuery), catalog, {
    isExpectedChassis: isExpectedChassisForMakeModel,
  });

  const make = plan.vehicle.make ?? (resolved.makes.length === 1 ? resolved.makes[0] : null);
  const model = plan.vehicle.model ?? (resolved.models.length === 1 ? resolved.models[0] : null);
  const modelChassis =
    resolved.chassis.length > 0
      ? []
      : catalog.flatMap((item) =>
          (!make || sameVehicleValue(item.fitment.make, make)) &&
          (!model || item.fitment.models.some((value) => sameVehicleValue(value, model)))
            ? item.fitment.chassisCodes
            : []
        );
  const catalogChassis = unique([...resolved.chassis, ...modelChassis]).filter(
    (chassis) => !make || !model || isExpectedChassisForMakeModel(make, model, chassis)
  );
  const explicitChassis = plan.vehicle.chassis;
  const chassis = explicitChassis ?? (catalogChassis.length === 1 ? catalogChassis[0] : null);

  let vehicleResolution: ShopAiVehicleResolution;
  if (!make || !model) {
    vehicleResolution = {
      status: "incomplete",
      confidence: "low",
      source: "unresolved",
      candidates: catalogChassis,
      reason: "make-or-model-missing",
    };
  } else if (explicitChassis) {
    vehicleResolution = {
      status: "resolved",
      confidence: "high",
      source: "explicit",
      candidates: [explicitChassis],
      reason: "explicit-chassis",
    };
  } else if (chassis) {
    vehicleResolution = {
      status: "resolved",
      confidence: plan.vehicle.year ? "high" : "medium",
      source: "catalog",
      candidates: [chassis],
      reason: plan.vehicle.year ? "catalog-year-resolution" : "catalog-fitment-resolution",
    };
  } else if (catalogChassis.length > 1) {
    vehicleResolution = {
      status: "ambiguous",
      confidence: "low",
      source: "catalog",
      candidates: catalogChassis,
      reason: "multiple-generations-match",
    };
  } else {
    vehicleResolution = {
      status: "incomplete",
      confidence: "low",
      source: "unresolved",
      candidates: [],
      reason: "insufficient-catalog-evidence",
    };
  }

  return finalizeShopAiPlan(
    {
      ...plan,
      vehicle: {
        ...plan.vehicle,
        make,
        model,
        chassis,
      },
      vehicleResolution,
    },
    context
  );
}
