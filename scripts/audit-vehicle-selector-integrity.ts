/**
 * Read-only audit of the "Деталі для" vehicle picker against the listing it
 * opens. Sends GET requests only (concurrency 3, retries on 5xx).
 *
 *   npx tsx scripts/audit-vehicle-selector-integrity.ts <baseUrl> [--makes "Porsche|BMW"] [--json out.json]
 *
 * For each make it walks make -> model -> chassis exactly as the picker does
 * and reports:
 *   - dead ends: a model/chassis option the picker offers that opens 0 products;
 *   - make loss: products visible for the bare make but unreachable from any of
 *     its models (only with --reach, it pages through every result);
 * A non-zero exit code means at least one dead end was found.
 */
import fs from "node:fs";

const CONCURRENCY = 3;
const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : null;
};
const baseUrl = (args.find((arg) => /^https?:\/\//.test(arg)) ?? "").replace(/\/$/, "");
const makesArg = flag("--makes");
const jsonOut = flag("--json");
const checkReach = args.includes("--reach");

if (!baseUrl) {
  console.error(
    'usage: audit-vehicle-selector-integrity.ts <baseUrl> [--makes "A|B"] [--json out] [--reach]'
  );
  process.exit(2);
}

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      return getJson<T>(url, attempt + 1);
    }
    throw new Error(`${(error as Error).message} ${url}`);
  }
}

async function pool<T>(items: readonly T[], run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await run(items[next++]!);
    })
  );
}

type Options = { data: string[]; counts?: Record<string, number> };
const fitment = (params: Record<string, string>) =>
  getJson<Options>(
    `${baseUrl}/api/shop/stock/fitment?${new URLSearchParams({ scope: "auto", ...params })}`
  );
const search = (params: Record<string, string>, page = "1", limit = "1") =>
  getJson<{ data: { id: string }[]; meta: { totalItems: number; totalPages: number } }>(
    `${baseUrl}/api/shop/stock/search?${new URLSearchParams({ locale: "ua", scope: "auto", page, limit, ...params })}`
  );
const total = async (params: Record<string, string>) => (await search(params)).meta.totalItems;

async function ids(params: Record<string, string>) {
  const found: string[] = [];
  for (let page = 1; ; page += 1) {
    const result = await search(params, String(page), "96");
    found.push(...result.data.map((row) => row.id));
    if (page >= result.meta.totalPages) return found;
  }
}

type Report = {
  make: string;
  models: number;
  chassisOptions: number;
  deadModels: string[];
  deadChassis: string[];
  makeOnly?: number;
  reachableViaModels?: number;
  lostAfterModel?: number;
};

async function auditMake(make: string): Promise<Report> {
  const models = (await fitment({ make })).data;
  const report: Report = {
    make,
    models: models.length,
    chassisOptions: 0,
    deadModels: [],
    deadChassis: [],
  };
  await pool(models, async (model) => {
    if ((await total({ make, model })) === 0) report.deadModels.push(model);
    const chassis = (await fitment({ make, model })).data;
    report.chassisOptions += chassis.length;
    for (const code of chassis) {
      if ((await total({ make, model, chassis: code })) === 0) {
        report.deadChassis.push(`${model} / ${code}`);
      }
    }
  });
  if (checkReach) {
    const bare = new Set(await ids({ make }));
    const reachable = new Set<string>();
    await pool(models, async (model) => {
      for (const id of await ids({ make, model })) reachable.add(id);
    });
    report.makeOnly = bare.size;
    report.reachableViaModels = reachable.size;
    report.lostAfterModel = [...bare].filter((id) => !reachable.has(id)).length;
  }
  return report;
}

async function main() {
  const makes = makesArg
    ? makesArg
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean)
    : (await fitment({})).data;
  const reports: Report[] = [];
  for (const make of makes) {
    const report = await auditMake(make);
    reports.push(report);
    console.log(
      `${make}: models ${report.models}, dead models ${report.deadModels.length}, ` +
        `chassis options ${report.chassisOptions}, dead chassis ${report.deadChassis.length}` +
        (report.makeOnly != null
          ? `, make-only ${report.makeOnly}, lost after picking a model ${report.lostAfterModel}`
          : "")
    );
    for (const line of report.deadModels) console.log(`  DEAD MODEL   ${line}`);
    for (const line of report.deadChassis) console.log(`  DEAD CHASSIS ${line}`);
  }
  const dead = reports.reduce((sum, r) => sum + r.deadModels.length + r.deadChassis.length, 0);
  console.log(`\n${reports.length} makes, ${dead} dead-end options`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(reports, null, 1));
  process.exitCode = dead ? 1 : 0;
}

void main();
