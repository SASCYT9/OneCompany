import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
const run = promisify(execFile);
const cases = [
  ["brand", { brand: "Revozport" }],
  ["brand-name-search", { q: "Revozport" }],
  ["exact-sku", { q: "RZ-AD-1001" }],
  ["sku-without-hyphens", { q: "RZAD1001" }],
  ["ukrainian-name", { brand: "Revozport", q: "передня губа" }],
  ["make-audi", { brand: "Revozport", make: "Audi" }],
  ["model-rs3", { brand: "Revozport", make: "Audi", model: "RS3" }],
  ["carbon-category", { brand: "Revozport", category: "carbon-aero" }],
  ["english-name", { brand: "Revozport", locale: "en", q: "front lip" }],
  ["make-bmw", { brand: "Revozport", make: "BMW" }],
  ["pagination", { brand: "Revozport", page: "2" }],
  ["price-range", { brand: "Revozport", minPrice: "300", maxPrice: "500", currency: "USD", sort: "price_asc" }],
  ["draft-hidden", { q: "RZ-BM-1171" }],
];
const result = [];
for (const [name, query] of cases) {
  const url = `https://onecompany.global/api/shop/stock/search?${new URLSearchParams({ locale: "ua", limit: "3", ...query })}`;
  try {
    const { stdout } = await run("curl.exe", ["--fail", "--silent", "--show-error", "--max-time", "45", url], { maxBuffer: 5_000_000 });
    const response = JSON.parse(stdout);
    const count = response.meta?.totalItems;
    const passed = name === "draft-hidden" ? count === 0
      : Number(count) > 0 && (!query.brand || response.data.every((p) => p.brand === "Revozport"))
        && (!name.startsWith("sku-") && name !== "exact-sku" || count === 1 && response.data[0]?.partNumber === "rzad1001")
        && (name !== "price-range" || response.data.every((p) => p.priceUsd >= 300 && p.priceUsd <= 500));
    const row = { name, passed, url, meta: response.meta, categories: response.filters?.categories, products: response.data?.map((p) => ({ sku: p.partNumber, brand: p.brand, title: p.name, slug: p.slug })) };
    result.push(row);
    console.log(JSON.stringify(row));
  } catch (error) { result.push({ name, error: error.message }); console.log(`${name}: ${error.message}`); }
}
await mkdir(".tmp/revozport-enrichment", { recursive: true });
await writeFile(".tmp/revozport-enrichment/search-audit.json", JSON.stringify({ checkedAt: new Date().toISOString(), results: result }, null, 2));
console.log(JSON.stringify({ checks: result.length, passed: result.filter((r) => r.passed).length, failed: result.filter((r) => !r.passed).map((r) => r.name) }));
if (result.some((r) => !r.passed)) process.exitCode = 1;
