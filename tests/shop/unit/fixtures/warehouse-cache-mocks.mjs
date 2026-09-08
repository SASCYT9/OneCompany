export const state = (globalThis.__warehouseCacheTestState ??= { calls: [], fail: false });
export const prisma = {
  shopProduct: {
    async findMany(args) {
      state.calls.push(args);
      await new Promise((resolve) => setImmediate(resolve));
      if (state.fail) throw new Error("warehouse unavailable");
      return [{ id: `stock-${state.calls.length}`, sku: "SKU", slug: "stock" }];
    },
  },
};
