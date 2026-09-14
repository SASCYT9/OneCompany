import fs from "node:fs";
import path from "node:path";
import { shopSearchVariationCases } from "../tests/shop/fixtures/shopSearchVariationCases";

// Read-only HTTP audit. Compare equivalent wording against a canonical query,
// checking missing products and unrelated brands, not a fixed ranking order.
const option = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const baseUrl = option("base-url", "http://localhost:3100");
if (!["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname))
  throw new Error("Search variation audit requires a local storefront");
const locales = option("locales", "ua,en").split(",");
const endpoints = option("endpoints", "search,suggest").split(",");
if (
  locales.some((locale) => !["ua", "en"].includes(locale)) ||
  endpoints.some((endpoint) => !["search", "suggest"].includes(endpoint))
)
  throw new Error("Unsupported locale or search endpoint");
const output = option("output", "artifacts/search-variations.json");
type Product = { type?: string; brand?: string; partNumber?: string; slug?: string };
type Response = { data?: Product[]; meta?: { totalItems?: number; correctedQuery?: string } };
type Observation = {
  query: string;
  status: number;
  total?: number;
  skus: string[];
  brands: string[];
  correctedQuery?: string;
  error?: string;
};
const results: Array<{
  brand: string;
  locale: string;
  endpoint: string;
  baseline: Observation;
  checks: Array<Observation & { failures: string[] }>;
}> = [];

async function search(
  query: string,
  scope: string,
  locale: string,
  endpoint: string
): Promise<Observation> {
  try {
    const response = await fetch(
      `${baseUrl}/api/shop/stock/${endpoint}?${new URLSearchParams({ q: query, scope, locale, limit: "96" })}`,
      { signal: AbortSignal.timeout(45_000) }
    );
    const result = (await response.json()) as Response;
    const products = (result.data ?? []).filter((item) => !item.type || item.type === "product");
    return {
      query,
      status: response.status,
      total: result.meta?.totalItems,
      correctedQuery: result.meta?.correctedQuery,
      skus: products.map((p) => p.partNumber ?? p.slug ?? ""),
      brands: [...new Set(products.map((p) => p.brand ?? ""))],
    };
  } catch (error) {
    return { query, status: 0, skus: [], brands: [], error: String(error) };
  }
}

async function main() {
  let next = 0;
  const jobs = shopSearchVariationCases.flatMap((family) =>
    locales.flatMap((locale) => endpoints.map((endpoint) => ({ family, locale, endpoint })))
  );
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next < jobs.length) {
        const { family, locale, endpoint } = jobs[next++];
        const scope = family.scope ?? "auto";
        const baseline = await search(family.query, scope, locale, endpoint);
        const group: (typeof results)[number] = {
          brand: family.brand,
          locale,
          endpoint,
          baseline,
          checks: [],
        };
        for (const query of [family.query, ...family.variants]) {
          const result =
            query === family.query ? baseline : await search(query, scope, locale, endpoint);
          const failures: string[] = [];
          if (result.status !== 200) failures.push("http_error");
          if (!result.skus.length) failures.push("no_products");
          if (result.brands.some((brand) => brand.toLowerCase() !== family.brand.toLowerCase()))
            failures.push("unrelated_brand");
          if (baseline.skus.length && !result.skus.some((sku) => baseline.skus.includes(sku)))
            failures.push("no_baseline_overlap");
          if (endpoint === "search" && result.total !== baseline.total)
            failures.push("different_total");
          if (
            endpoint === "search" &&
            baseline.total === baseline.skus.length &&
            baseline.skus.some((sku) => !result.skus.includes(sku))
          )
            failures.push("missing_baseline_product");
          group.checks.push({ ...result, failures });
        }
        results.push(group);
        console.log(
          JSON.stringify({
            brand: family.brand,
            locale,
            endpoint,
            total: baseline.total,
            failures: group.checks
              .filter((c) => c.failures.length)
              .map((c) => ({ q: c.query, reasons: c.failures, total: c.total, brands: c.brands })),
          })
        );
      }
    })
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    groups: results.length,
    checks: results.reduce((n, r) => n + r.checks.length, 0),
    failed: results.reduce((n, r) => n + r.checks.filter((c) => c.failures.length).length, 0),
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ summary, results }, null, 2));
  console.log(JSON.stringify(summary));
  if (summary.failed) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
