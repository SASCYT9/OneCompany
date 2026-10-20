export const state =
  globalThis.__canonicalVehicleIdsMockState ??
  (globalThis.__canonicalVehicleIdsMockState = {
    localMode: false,
    applicationArgs: [],
    applicationsByChassis: {},
  });

export function reset() {
  state.localMode = false;
  state.applicationArgs.length = 0;
  state.applicationsByChassis = {};
}

export function isLocalStorefrontMode() {
  return state.localMode;
}

/** The chassis an application query asks for: the first `in` value of its chassis filter. */
function requestedChassis(where) {
  const exact = (where?.OR ?? []).find((filter) => filter.chassisCode?.in);
  return String(exact?.chassisCode.in[0] ?? "").toUpperCase();
}

export const prisma = {
  shopCatalogProjectionConstraint: {
    findMany: async () => [],
  },
  shopVehicleApplication: {
    findMany: async (args) => {
      state.applicationArgs.push(args);
      const ids = state.applicationsByChassis[requestedChassis(args.where)] ?? [];
      return ids.map((productId) => ({ productId }));
    },
  },
  shopCatalogProjectionClause: {
    findMany: async () => [],
  },
};
