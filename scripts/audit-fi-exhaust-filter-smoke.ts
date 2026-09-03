import { countShopCatalogProjection, queryShopCatalogProjection } from "../src/lib/shopCatalogProjectionQuery.server";

const cases = [
  { make: "BMW", model: "M5", generation: "G90" },
  { make: "Audi", model: "RSQ8" },
  { make: "Toyota", model: "GR86", generation: "ZN8" },
] as const;

async function main() {
  for (const filter of cases) {
    const query = { locale: "en" as const, brand: "Fi EXHAUST", limit: 100, ...filter };
    const [count, result] = await Promise.all([countShopCatalogProjection(query), queryShopCatalogProjection(query)]);
    process.stdout.write(`${JSON.stringify({ filter, count, slugs: result.items.map((item) => item.slug) }, null, 2)}\n`);
    if (count < 1 || result.items.length < 1) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
