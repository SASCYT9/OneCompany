export const state =
  globalThis.__canonicalVehicleIdsMockState ??
  (globalThis.__canonicalVehicleIdsMockState = {
    localMode: false,
    applicationArgs: [],
    clauseArgs: [],
    applications: [],
    clauses: [],
  });

export function reset() {
  state.localMode = false;
  state.applicationArgs.length = 0;
  state.clauseArgs.length = 0;
  state.applications = [];
  state.clauses = [];
}

export function isLocalStorefrontMode() {
  return state.localMode;
}

const lowerSet = (values) => new Set(values.map((value) => String(value).toLowerCase()));

/** Stored rows ({ productId, model, chassis }) a query's model/chassis filters admit. */
function matchingIds(rows, models, chassis) {
  return rows
    .filter(
      (row) =>
        (!models || models.has(row.model.toLowerCase())) &&
        (!chassis || row.chassis.toUpperCase() === chassis)
    )
    .map(({ productId }) => ({ productId }));
}

export const prisma = {
  shopCatalogProjectionConstraint: {
    findMany: async () => [],
  },
  shopVehicleApplication: {
    findMany: async (args) => {
      state.applicationArgs.push(args);
      const models = args.where.model?.in ? lowerSet(args.where.model.in) : null;
      const exactChassis = (args.where.OR ?? []).find((filter) => filter.chassisCode?.in);
      const chassis = exactChassis ? String(exactChassis.chassisCode.in[0]).toUpperCase() : null;
      return matchingIds(state.applications, models, chassis);
    },
  },
  shopCatalogProjectionClause: {
    findMany: async (args) => {
      state.clauseArgs.push(args);
      const constraints = (args.where.AND ?? []).map((entry) => entry.constraints.some);
      const model = constraints.find((constraint) => constraint.dimension === "MODEL");
      const generation = constraints.find((constraint) => constraint.OR);
      const models = model ? lowerSet(model.textValue.in) : null;
      const chassis = generation ? String(generation.OR[0].textValue.in[0]).toUpperCase() : null;
      return matchingIds(state.clauses, models, chassis);
    },
  },
};
