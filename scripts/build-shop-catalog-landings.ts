/**
 * Builds src/data/shopCatalogLandings.json: the catalog landing pages that
 * have enough products to be worth indexing (see src/lib/shopCatalogLandings.ts).
 *
 * Run: npx tsx scripts/build-shop-catalog-landings.ts --collect
 *   --collect   read counts from the public catalog search (one request at a
 *               time with a pause; about 800 requests) and save them to --raw
 *   --raw FILE  raw counts (default tmp/shop-catalog-landings-raw.json); without
 *               --collect the list is rebuilt from this file only
 *   --base URL  site to read from (default https://onecompany.global)
 */
import fs from "node:fs";
import path from "node:path";
import {
  SHOP_CATALOG_LANDING_BRANDS,
  SHOP_CATALOG_LANDING_CATEGORIES,
  SHOP_CATALOG_LANDING_MIN_PRODUCTS as MIN,
  catalogLandingBrandSlug,
  slugifyCatalogLandingSegment,
  type ShopCatalogLanding,
  type ShopCatalogLandingCategoryKey,
} from "../src/lib/shopCatalogLandings";
import { shopCatalogLandingFilterKey } from "../src/lib/shopCatalogLandingUrl";

type Counts = { total: number; categories: Record<string, number>; brands: Record<string, number> };
type Task =
  | { kind: "brand"; brand: string }
  | { kind: "makeCategory"; make: string; category: string }
  | { kind: "makeBrand"; make: string; brand: string }
  | { kind: "makeModel"; make: string; model: string };
type Raw = {
  makes: Array<{ make: string } & Counts>;
  models: Record<string, string[]>;
  landing: Array<{ task: Task } & Counts>;
};

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const RAW_FILE = option("--raw") ?? path.join("tmp", "shop-catalog-landings-raw.json");
const BASE = (option("--base") ?? "https://onecompany.global").replace(/\/$/, "");
const OUT_FILE = path.join("src", "data", "shopCatalogLandings.json");
/** Brand label → landing slug, for brand links across the shop (tiny on purpose). */
const BRAND_HUBS_FILE = path.join("src", "data", "shopCatalogLandingBrandHubs.json");
/** Filter set → landing path, for the browser catalog and old filter URLs. */
const KEYS_FILE = path.join("src", "data", "shopCatalogLandingKeys.json");
const TOP_MAKES_WITH_MODELS = 10;
/** Brands without their own storefront get a brand landing page. */
const CATALOG_ONLY_BRANDS = Object.entries(SHOP_CATALOG_LANDING_BRANDS)
  .filter(([, brand]) => !brand.storefront)
  .map(([label]) => label);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(pathAndQuery: string): Promise<any> {
  const response = await fetch(`${BASE}${pathAndQuery}`, {
    headers: { "user-agent": "OneCompany catalog landing builder" },
  });
  if (!response.ok) throw new Error(`${response.status} for ${pathAndQuery}`);
  const body = await response.json();
  await pause(500);
  return body;
}

async function searchCounts(filters: Record<string, string>): Promise<Counts> {
  const params = new URLSearchParams({
    locale: "ua",
    currency: "UAH",
    country: "Ukraine",
    page: "1",
    ...filters,
  });
  const body = await getJson(`/api/shop/stock/search?${params}`);
  return {
    total: body.meta?.totalItems ?? 0,
    categories: Object.fromEntries(
      (body.filterStats?.categories ?? [])
        .filter((row: any) => row.key)
        .map((row: any) => [row.key, row.count])
    ),
    brands: Object.fromEntries(
      (body.filterStats?.brands ?? []).map((row: any) => [row.label, row.count])
    ),
  };
}

// Generation variants ("Golf IV", "Fiesta Mk VII") and merged names ("A / B")
// are left for chassis-level pages; the family name covers them.
const GENERATION = /\s(?:I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,2}|Mk\s?\w+)$/;
function modelCandidates(list: string[]): string[] {
  const names = new Set(list);
  return list.filter(
    (name) =>
      !name.includes("/") && !(GENERATION.test(name) && names.has(name.replace(GENERATION, "")))
  );
}

async function collect(): Promise<Raw> {
  const makesList: string[] = (await getJson("/api/shop/stock/fitment?locale=ua")).data ?? [];
  const makes: Raw["makes"] = [];
  for (const make of makesList) {
    makes.push({ make, ...(await searchCounts({ make })) });
    process.stdout.write(`\rmakes ${makes.length}/${makesList.length}`);
  }
  const topMakes = [...makes].sort((a, b) => b.total - a.total).slice(0, TOP_MAKES_WITH_MODELS);
  const models: Raw["models"] = {};
  for (const { make } of topMakes) {
    models[make] =
      (await getJson(`/api/shop/stock/fitment?${new URLSearchParams({ locale: "ua", make })}`))
        .data ?? [];
  }
  const tasks: Task[] = [
    ...CATALOG_ONLY_BRANDS.map((brand) => ({ kind: "brand" as const, brand })),
    ...makes.flatMap((row) => [
      ...Object.entries(row.categories)
        .filter(([, count]) => count >= MIN)
        .map(([category]) => ({ kind: "makeCategory" as const, make: row.make, category })),
      ...Object.entries(row.brands)
        .filter(([, count]) => count >= MIN)
        .map(([brand]) => ({ kind: "makeBrand" as const, make: row.make, brand })),
    ]),
    ...Object.entries(models).flatMap(([make, list]) =>
      modelCandidates(list).map((model) => ({ kind: "makeModel" as const, make, model }))
    ),
  ];
  const landing: Raw["landing"] = [];
  for (const task of tasks) {
    const { kind: _kind, ...filters } = task;
    landing.push({ task, ...(await searchCounts(filters as Record<string, string>)) });
    process.stdout.write(`\rpages ${landing.length}/${tasks.length}   `);
  }
  process.stdout.write("\n");
  return { makes, models, landing };
}

// ---------- selection ----------

const FAMILY = /-Class$|^[A-Z]?\d Series$/;
const ENGINE_VARIANT = /^(?:AMG )?[A-Z]{1,3} ?\d{2,3}[a-z]?(?: [A-Z]{1,4})?$/;

/** Among near-identical model pages keep the name people search for ("GLE-Class", not "GLE 450"). */
function modelPriority(name: string): [number, number, string] {
  const rank = FAMILY.test(name)
    ? 0
    : ENGINE_VARIANT.test(name) && !name.startsWith("AMG ")
      ? 3
      : name.startsWith("AMG ")
        ? 2
        : 1;
  return [rank, name.length, name];
}

const near = (a: number, b: number, share: number) => a >= share * b && b >= share * a;
const sameCounts = (a: Record<string, number>, b: Record<string, number>) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

export function selectShopCatalogLandings(raw: Raw): {
  landings: ShopCatalogLanding[];
  excluded: Array<{ page: string; count: number; reason: string }>;
} {
  const landings: ShopCatalogLanding[] = [];
  const excluded: Array<{ page: string; count: number; reason: string }> = [];
  const makeTotal = new Map(raw.makes.map((row) => [row.make, row.total]));
  const wholeMake = (make: string, count: number) =>
    count >= 0.9 * (makeTotal.get(make) ?? Infinity);
  const makeSlug = (make: string) => slugifyCatalogLandingSegment(make);

  for (const row of [...raw.makes].sort((a, b) => b.total - a.total)) {
    if (row.total < MIN) continue;
    landings.push({
      kind: "make",
      path: `catalog/${makeSlug(row.make)}`,
      make: row.make,
      count: row.total,
    });
  }

  const modelRows = new Map<string, Raw["landing"]>();
  for (const row of raw.landing) {
    if (row.task.kind !== "makeModel" || row.total < MIN) continue;
    modelRows.set(row.task.make, [...(modelRows.get(row.task.make) ?? []), row]);
  }
  for (const [make, rows] of modelRows) {
    const sorted = [...rows].sort((a, b) => {
      const [ra, la, na] = modelPriority((a.task as { model: string }).model);
      const [rb, lb, nb] = modelPriority((b.task as { model: string }).model);
      return ra - rb || la - lb || na.localeCompare(nb);
    });
    const kept: Raw["landing"] = [];
    for (const row of sorted) {
      const model = (row.task as { model: string }).model;
      if (wholeMake(make, row.total)) {
        excluded.push({
          page: `${make} ${model}`,
          count: row.total,
          reason: "almost the whole make",
        });
        continue;
      }
      const twin = kept.find((other) => {
        const otherModel = (other.task as { model: string }).model;
        const family = otherModel.match(/^([A-Z]{1,3})-Class$/)?.[1];
        return (
          (model.startsWith(`${otherModel} `) && near(row.total, other.total, 0.85)) ||
          (sameCounts(row.categories, other.categories) && near(row.total, other.total, 0.95)) ||
          (family !== undefined &&
            new RegExp(`^(?:AMG )?${family} \\d`).test(model) &&
            row.total >= 0.85 * other.total)
        );
      });
      if (twin) {
        excluded.push({
          page: `${make} ${model}`,
          count: row.total,
          reason: `same products as ${make} ${(twin.task as { model: string }).model}`,
        });
        continue;
      }
      kept.push(row);
    }
    for (const row of kept.sort((a, b) => b.total - a.total)) {
      const model = (row.task as { model: string }).model;
      landings.push({
        kind: "model",
        path: `catalog/${makeSlug(make)}/${slugifyCatalogLandingSegment(model)}`,
        make,
        model,
        count: row.total,
      });
    }
  }

  const categoryPages = new Set<string>();
  for (const row of raw.landing) {
    if (row.task.kind !== "makeCategory" || row.total < MIN) continue;
    const { make, category } = row.task;
    if (!(category in SHOP_CATALOG_LANDING_CATEGORIES)) continue;
    if (wholeMake(make, row.total)) {
      excluded.push({
        page: `${category} for ${make}`,
        count: row.total,
        reason: "almost the whole make",
      });
      continue;
    }
    const key = category as ShopCatalogLandingCategoryKey;
    categoryPages.add(`${make}|${key}`);
    landings.push({
      kind: "category",
      path: `catalog/${makeSlug(make)}/${SHOP_CATALOG_LANDING_CATEGORIES[key].slug}`,
      make,
      category: key,
      count: row.total,
    });
  }

  for (const row of raw.landing) {
    if (row.task.kind !== "brand" || row.total < MIN) continue;
    landings.push({
      kind: "brand",
      path: `brand/${catalogLandingBrandSlug(row.task.brand)}`,
      brand: row.task.brand,
      count: row.total,
    });
  }

  for (const row of raw.landing) {
    if (row.task.kind !== "makeBrand" || row.total < MIN) continue;
    const { make, brand } = row.task;
    if (wholeMake(make, row.total)) {
      excluded.push({
        page: `${brand} for ${make}`,
        count: row.total,
        reason: "almost the whole make",
      });
      continue;
    }
    // A brand that is ≥ 90% of a category page for this make is that page
    // under another name; the category page keeps the brand in its title.
    const twin = raw.landing.find((other) => {
      if (other.task.kind !== "makeCategory" || other.task.make !== make) return false;
      if (!categoryPages.has(`${make}|${other.task.category}`)) return false;
      const inside = other.brands[brand] ?? 0;
      return inside >= 0.9 * other.total && inside >= 0.9 * row.total;
    });
    if (twin) {
      excluded.push({
        page: `${brand} for ${make}`,
        count: row.total,
        reason: `same products as ${(twin.task as { category: string }).category} for ${make}`,
      });
      continue;
    }
    landings.push({
      kind: "brandMake",
      path: `brand/${catalogLandingBrandSlug(brand)}/${makeSlug(make)}`,
      make,
      brand,
      count: row.total,
    });
  }

  const order = ["make", "model", "category", "brand", "brandMake"];
  landings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.count - a.count);
  return { landings, excluded };
}

async function main() {
  let raw: Raw;
  if (args.includes("--collect")) {
    raw = await collect();
    fs.mkdirSync(path.dirname(RAW_FILE), { recursive: true });
    fs.writeFileSync(RAW_FILE, JSON.stringify(raw));
  } else {
    raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf8"));
  }
  const { landings, excluded } = selectShopCatalogLandings(raw);
  const paths = new Set(landings.map((landing) => landing.path));
  if (paths.size !== landings.length) throw new Error("Duplicate landing paths");
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(landings, null, 2)}\n`);
  const brandHubs = Object.fromEntries(
    landings
      .filter((landing) => landing.kind === "brand" && landing.brand)
      .map((landing) => [landing.brand as string, landing.path.replace(/^brand\//, "")])
  );
  fs.writeFileSync(BRAND_HUBS_FILE, `${JSON.stringify(brandHubs, null, 2)}\n`);
  const keys = Object.fromEntries(
    landings.map((landing) => [
      shopCatalogLandingFilterKey({
        brand: landing.brand,
        category: landing.category,
        make: landing.make,
        model: landing.model,
      }),
      landing.path,
    ])
  );
  fs.writeFileSync(KEYS_FILE, `${JSON.stringify(keys)}\n`);
  const byKind = landings.reduce<Record<string, number>>((acc, landing) => {
    acc[landing.kind] = (acc[landing.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `${landings.length} landing pages ${JSON.stringify(byKind)}, ${excluded.length} left out → ${OUT_FILE}`
  );
}

if (process.argv[1] && /build-shop-catalog-landings\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
