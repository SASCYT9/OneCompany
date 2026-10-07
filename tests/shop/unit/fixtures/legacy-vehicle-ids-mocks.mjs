export const state =
  globalThis.__legacyVehicleIdsMockState ??
  (globalThis.__legacyVehicleIdsMockState = {
    applicationCalls: 0,
    projectionCalls: 0,
    catalogCalls: 0,
    metafieldCalls: 0,
    metafieldArgs: [],
    supplierFitmentValue: null,
    supplierFitmentProductId: "fitment-id",
    productSearchIds: [],
    productSearchArgs: [],
    applicationArgs: [],
    projectionArgs: [],
    rejectApplicationOnce: false,
  });

export function reset() {
  state.applicationCalls = 0;
  state.projectionCalls = 0;
  state.catalogCalls = 0;
  state.metafieldCalls = 0;
  state.metafieldArgs.length = 0;
  state.supplierFitmentValue = null;
  state.supplierFitmentProductId = "fitment-id";
  state.productSearchIds.length = 0;
  state.productSearchArgs.length = 0;
  state.applicationArgs.length = 0;
  state.projectionArgs.length = 0;
  state.rejectApplicationOnce = false;
}

export const prisma = {
  shopProduct: {
    findMany: async (args) => {
      state.productSearchArgs.push(args);
      if (!state.productSearchIds.length) throw new Error("no product text candidates configured");
      return state.productSearchIds.map((id) => ({ id }));
    },
  },
  shopProductMetafield: {
    findMany: async (args) => {
      state.metafieldCalls += 1;
      state.metafieldArgs.push(args);
      return state.supplierFitmentValue
        ? [
            {
              productId: state.supplierFitmentProductId,
              namespace: "onecompany",
              key: "supplier_fitment",
              value: state.supplierFitmentValue,
            },
          ]
        : [];
    },
  },
  shopVehicleApplication: {
    findMany: async (args) => {
      state.applicationCalls += 1;
      state.applicationArgs.push(args);
      if (state.rejectApplicationOnce) {
        state.rejectApplicationOnce = false;
        throw new Error("test failure");
      }
      return [
        {
          productId: "application-id",
          model: "M5",
          chassisCode: "G90",
          yearFrom: 2020,
          yearTo: null,
        },
      ];
    },
  },
  shopCatalogProjectionClause: {
    findMany: async (args) => {
      state.projectionCalls += 1;
      state.projectionArgs.push(args);
      return [
        {
          productId: "projection-id",
          constraints: [
            { dimension: "MAKE", state: "EXACT", textValue: "BMW", yearFrom: null, yearTo: null },
            { dimension: "MODEL", state: "EXACT", textValue: "M5", yearFrom: null, yearTo: null },
            {
              dimension: "GENERATION",
              state: "EXACT",
              textValue: "G90",
              yearFrom: null,
              yearTo: null,
            },
            { dimension: "YEAR", state: "EXACT", textValue: null, yearFrom: 2020, yearTo: null },
          ],
        },
      ];
    },
  },
};

export async function getShopFitmentCatalogProducts(options) {
  state.catalogCalls += 1;
  if (!options?.evidenceOnly) throw new Error("evidenceOnly expected");
  const id = options.productIds?.[0] ?? "fitment-id";
  return [{ id, brand: "BMC" }];
}

export function extractProductFitment() {
  return { make: "BMW", model: "M5", chassisCodes: ["G90"], years: [{ from: 2020, to: null }] };
}

export function shopFitmentMatchesVehicleConstraints(fitment, constraints) {
  const models = fitment.models ?? (fitment.model ? [fitment.model] : []);
  return (
    String(fitment.make ?? "").toLowerCase() === String(constraints.make ?? "").toLowerCase() &&
    (!constraints.model ||
      models.some((model) => String(model).toLowerCase() === constraints.model.toLowerCase()))
  );
}

export function normalizeShopSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function canonicalVehicleMakeLabel(value) {
  return String(value ?? "").trim() === "bmw" ? "BMW" : String(value ?? "").trim();
}

export function canonicalVehicleModelLabel(_make, value) {
  return value;
}
export function vehicleModelKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
export function vehicleMakeAliases(make) {
  return make === "Škoda" ? ["Škoda", "skoda", "škoda"] : ["BMW", "bmw"];
}

export function vehicleModelAliases(_make, value) {
  if (["amg g 63", "amg g63", "g63", "g63 amg"].includes(String(value ?? "").toLowerCase())) {
    return ["AMG G 63", "AMG G63", "G63", "G63 AMG"];
  }
  return [value, String(value ?? "").replace(/\s+/g, "-")];
}
