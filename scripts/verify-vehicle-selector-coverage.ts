/**
 * Read-only check that a vehicle selector change loses no products. Sends GET
 * requests only.
 *
 *   npx tsx scripts/verify-vehicle-selector-coverage.ts snapshot <baseUrl> <out.json>
 *   npx tsx scripts/verify-vehicle-selector-coverage.ts verify <baseUrl> <snapshot.json>
 *
 * `snapshot` records, for every make and model the selector offers, the ids of
 * the products the listing returns. `verify` maps each recorded model through
 * the current taxonomy and asserts every recorded product is still returned by
 * the model(s) it maps to.
 */
import fs from "node:fs";
import {
  canonicalizeVehicleModels,
  canonicalVehicleMakeLabel,
} from "../src/lib/shopVehicleTaxonomy";

type Snapshot = Record<string, Record<string, string[]>>;

const PAGE_SIZE = 100;
const CONCURRENCY = 4;

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    if (attempt < 4 && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      return getJson(url, attempt + 1);
    }
    throw new Error(`${response.status} ${url}`);
  }
  return (await response.json()) as T;
}

async function productIds(base: string, make: string, model: string) {
  const ids: string[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      locale: "ua",
      scope: "auto",
      make,
      model,
      limit: String(PAGE_SIZE),
      page: String(page),
    });
    const result = await getJson<{ data?: { id: string }[]; meta?: { totalPages?: number } }>(
      `${base}/api/shop/stock/search?${params}`
    );
    ids.push(...(result.data ?? []).map((row) => row.id));
    if (page >= (result.meta?.totalPages ?? 1)) return ids;
  }
}

async function mapLimit<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await run(items[next++]!);
    })
  );
}

async function snapshot(base: string, out: string) {
  const fitment = `${base}/api/shop/stock/fitment?scope=auto`;
  const makes = (await getJson<{ data: string[] }>(fitment)).data;
  const result: Snapshot = {};
  const jobs: { make: string; model: string }[] = [];
  for (const make of makes) {
    const models = (
      await getJson<{ data: string[] }>(`${fitment}&make=${encodeURIComponent(make)}`)
    ).data;
    result[make] = {};
    for (const model of models) jobs.push({ make, model });
  }
  let done = 0;
  await mapLimit(jobs, async ({ make, model }) => {
    result[make]![model] = await productIds(base, make, model);
    if (++done % 200 === 0) console.log(`${done}/${jobs.length}`);
  });
  fs.writeFileSync(out, JSON.stringify(result));
  console.log(`${jobs.length} models of ${makes.length} makes saved to ${out}`);
}

async function verify(base: string, file: string) {
  const before = JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot;
  const after = new Map<string, Promise<Set<string>>>();
  const idsAfter = (make: string, model: string) => {
    const key = `${make}\u0000${model}`;
    if (!after.has(key)) {
      after.set(
        key,
        productIds(base, make, model).then((ids) => new Set(ids))
      );
    }
    return after.get(key)!;
  };
  const jobs = Object.entries(before).flatMap(([make, models]) =>
    Object.entries(models).map(([model, ids]) => ({ make, model, ids }))
  );
  const lost: string[] = [];
  const unoffered: string[] = [];
  let checked = 0;
  await mapLimit(jobs, async ({ make, model, ids }) => {
    checked += ids.length;
    const canonicalMake = canonicalVehicleMakeLabel(make);
    const labels = canonicalizeVehicleModels(canonicalMake, [model]);
    if (!labels.length) {
      if (ids.length) unoffered.push(`${make} / ${model}: ${ids.length} products`);
      return;
    }
    const reachable = new Set<string>();
    for (const label of labels) {
      for (const id of await idsAfter(canonicalMake, label)) reachable.add(id);
    }
    const missing = ids.filter((id) => !reachable.has(id));
    if (missing.length) {
      lost.push(
        `${make} / ${model} -> ${labels.join(", ")}: ${missing.length} of ${ids.length} missing`
      );
    }
  });
  for (const line of unoffered) console.log(`UNOFFERED ${line}`);
  for (const line of lost) console.log(`LOST      ${line}`);
  console.log(
    `\n${jobs.length} models, ${checked} product matches checked; ${lost.length} models lose products, ${unoffered.length} models no longer offered`
  );
  process.exitCode = lost.length ? 1 : 0;
}

const [mode, base = "", file = ""] = process.argv.slice(2);
const baseUrl = base.replace(/\/$/, "");
if (mode === "snapshot" && baseUrl && file) void snapshot(baseUrl, file);
else if (mode === "verify" && baseUrl && file) void verify(baseUrl, file);
else {
  console.error("usage: snapshot|verify <baseUrl> <file.json>");
  process.exitCode = 2;
}
