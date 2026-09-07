import type {
  ShopCatalogSelectorApplication,
  ShopCatalogSelectorReadModel,
  ShopCatalogSelectorScope,
} from "./shopCatalogSelectorReadModel";

/**
 * The response shape shared by the legacy fitment endpoint and the selector
 * artifact. Keeping this adapter pure makes it safe to use from a route,
 * an SSR loader, or a build verification task.
 */
export type ShopCatalogSelectorRouteResponse =
  | { type: "makes"; data: readonly string[] }
  | { type: "models"; make: string; data: readonly string[] }
  | { type: "chassis"; make: string; model: string; data: readonly string[] }
  | {
      type: "details";
      make: string;
      model: string;
      chassis: string | null;
      data: { years: readonly number[]; engines: readonly string[] };
    }
  | {
      type: "engines";
      make: string;
      model: string;
      chassis: string;
      data: readonly string[];
    };

export type ShopCatalogSelectorRouteQuery = {
  make: string | null;
  model: string | null;
  chassis: string | null;
  scope: ShopCatalogSelectorScope | null;
  brand: string | null;
  details: boolean;
  year: number | null;
};

function key(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function matchesValue(values: readonly string[], selected: string | null) {
  if (!selected) return true;
  // An empty dimension is the read-model representation of ANY. It must not
  // hide universal products when a customer has already selected a make.
  return values.length === 0 || values.some((value) => key(value) === key(selected));
}

function matchesApplication(
  application: ShopCatalogSelectorApplication,
  query: ShopCatalogSelectorRouteQuery
) {
  if (query.scope && application.scope !== query.scope) return false;
  if (query.brand && key(application.brand) !== key(query.brand)) return false;
  if (!matchesValue(application.makes, query.make)) return false;
  if (!matchesValue(application.models, query.model)) return false;
  if (query.chassis) {
    const chassisOrGeneration = [...application.chassis, ...application.generations];
    if (!matchesValue(chassisOrGeneration, query.chassis)) return false;
  }
  if (query.year !== null && application.years.length && !application.years.includes(query.year)) {
    return false;
  }
  return true;
}

function uniqueSorted(values: Iterable<string>) {
  const result = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = key(trimmed);
    const existing = result.get(normalized);
    if (!existing || trimmed.localeCompare(existing, "en") < 0) result.set(normalized, trimmed);
  }
  return [...result.values()].sort((left, right) => left.localeCompare(right, "en"));
}

function matchingApplications(
  model: ShopCatalogSelectorReadModel,
  query: ShopCatalogSelectorRouteQuery
) {
  return model.applications.filter((application) => matchesApplication(application, query));
}

/**
 * Reads a fitment response from a published, complete selector artifact.
 * Incomplete artifacts return null so the caller can retain the existing
 * projection/legacy fallback without ever presenting partial selectors.
 */
export function selectShopCatalogFitmentFromReadModel(
  model: ShopCatalogSelectorReadModel,
  query: ShopCatalogSelectorRouteQuery
): ShopCatalogSelectorRouteResponse | null {
  if (!model.complete) return null;

  const baseQuery = { ...query, details: false };
  if (!query.make) {
    const applications = matchingApplications(model, baseQuery);
    return { type: "makes", data: uniqueSorted(applications.flatMap((item) => item.makes)) };
  }

  if (!query.model) {
    const applications = matchingApplications(model, baseQuery);
    return {
      type: "models",
      make: query.make,
      data: uniqueSorted(applications.flatMap((item) => item.models)),
    };
  }

  const applications = matchingApplications(model, baseQuery);
  if (query.details) {
    const years = new Set<number>();
    const engines: string[] = [];
    for (const application of applications) {
      for (const year of application.years) years.add(year);
      engines.push(...application.engines);
    }
    return {
      type: "details",
      make: query.make,
      model: query.model,
      chassis: query.chassis,
      data: {
        years: [...years].sort((left, right) => right - left),
        engines: uniqueSorted(engines),
      },
    };
  }

  if (query.chassis) {
    return {
      type: "engines",
      make: query.make,
      model: query.model,
      chassis: query.chassis,
      data: uniqueSorted(applications.flatMap((item) => item.engines)),
    };
  }

  return {
    type: "chassis",
    make: query.make,
    model: query.model,
    data: uniqueSorted(applications.flatMap((item) => [...item.chassis, ...item.generations])),
  };
}
