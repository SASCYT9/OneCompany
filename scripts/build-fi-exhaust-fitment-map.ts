import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type VehicleRow = { brand: string; model: string; body: string };
type ProductRow = { id: string; title: string; handle: string; status: string; brand: string | null; model: string | null; body: string | null };

const REVIEWED_APPLICATION_OVERRIDES: Readonly<Record<string, VehicleRow[]>> = {
  "fi-exhaust-80mm-ultimate-version-valvetronic-exhaust-system-porsche-911-turbo-turbo-s-991-1-991-2": [
    { brand: "Porsche", model: "911 Turbo", body: "991.1" },
    { brand: "Porsche", model: "911 Turbo", body: "991.2" },
    { brand: "Porsche", model: "911 Turbo S", body: "991.1" },
    { brand: "Porsche", model: "911 Turbo S", body: "991.2" },
  ],
};

const clean = (value: string) => value.trim();
const key = (value: string) => clean(value).toLocaleLowerCase("en-US");
const list = (value: string | null) => {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((item) => clean(String(item))).filter(Boolean) : [];
};

function parseCsv(csv: string): VehicleRow[] {
  return csv.split(/\r?\n/u).slice(1).filter((line) => line.trim()).map((line) => {
    const [brand = "", model = "", body = ""] = line.split(",");
    return { brand: clean(brand), model: clean(model), body: clean(body) };
  }).filter((row) => row.brand && row.model);
}

async function main() {
  const directory = resolve(process.argv[2] ?? "backups/shopify/fi-exhaust/2026-09-03");
  const csvRows = parseCsv(await readFile(resolve(directory, "vehicle_data.csv"), "utf8"));
  const source = JSON.parse(await readFile(resolve(directory, "product-fitment-metafields.json"), "utf8")) as { products: ProductRow[] };
  const products = source.products.filter((product) => product.status === "ACTIVE");
  const mapped = products.map((product) => {
    const reviewedOverride = REVIEWED_APPLICATION_OVERRIDES[product.handle];
    if (reviewedOverride) {
      return { ...product, status: "REVIEWED_OVERRIDE", applications: reviewedOverride };
    }
    const brands = list(product.brand);
    const models = list(product.model);
    const bodies = list(product.body);
    const csvMatches = csvRows.filter((row) =>
      brands.some((value) => key(value) === key(row.brand)) &&
      models.some((value) => key(value) === key(row.model)) &&
      (bodies.length === 0 ? !row.body : bodies.some((value) => key(value) === key(row.body)))
    );
    if (csvMatches.length > 0) return { ...product, status: "CSV_CORRELATED", applications: csvMatches };
    if (brands.length === 1 && models.length === 1 && bodies.length <= 1) {
      return { ...product, status: "METAFIELD_EXACT_SINGLE", applications: [{ brand: brands[0], model: models[0], body: bodies[0] ?? "" }] };
    }
    return { ...product, status: "REVIEW_REQUIRED", applications: [], sourceValues: { brands, models, bodies } };
  });
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      products: mapped.length,
      csvCorrelated: mapped.filter((item) => item.status === "CSV_CORRELATED").length,
      exactSingle: mapped.filter((item) => item.status === "METAFIELD_EXACT_SINGLE").length,
      reviewedOverrides: mapped.filter((item) => item.status === "REVIEWED_OVERRIDE").length,
      reviewRequired: mapped.filter((item) => item.status === "REVIEW_REQUIRED").length,
      applications: mapped.reduce((sum, item) => sum + item.applications.length, 0),
    },
    products: mapped,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile(resolve(directory, "fitment-map.json"), serialized, "utf8");
  process.stdout.write(`${JSON.stringify({ ...output.counts, sha256: createHash("sha256").update(serialized).digest("hex"), review: mapped.filter((item) => item.status === "REVIEW_REQUIRED").map((item) => ({ title: item.title, sourceValues: "sourceValues" in item ? item.sourceValues : null })) }, null, 2)}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
