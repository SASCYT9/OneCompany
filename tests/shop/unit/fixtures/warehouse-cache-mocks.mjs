export const state = (globalThis.__warehouseCacheTestState ??= {
  calls: [],
  fail: false,
  rows: null,
});
export const prisma = {
  shopProduct: {
    async findMany(args) {
      state.calls.push(args);
      await new Promise((resolve) => setImmediate(resolve));
      if (state.fail) throw new Error("warehouse unavailable");
      return state.rows ?? [{ id: `stock-${state.calls.length}`, sku: "85230", slug: "stock" }];
    },
  },
};
