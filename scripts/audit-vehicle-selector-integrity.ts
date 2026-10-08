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
// --titles: products whose title names make + model + chassis must be listed
// under that exact picker selection.
const checkTitles = args.includes("--titles");

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
    if (attempt < 7) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
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
type SearchRow = { id: string; name?: string; brand?: string };
const search = (params: Record<string, string>, page = "1", limit = "1") =>
  getJson<{ data: SearchRow[]; meta: { totalItems: number; totalPages: number } }>(
    `${baseUrl}/api/shop/stock/search?${new URLSearchParams({ locale: "ua", scope: "auto", page, limit, ...params })}`
  );
const total = async (params: Record<string, string>) => (await search(params)).meta.totalItems;

async function rows(params: Record<string, string>, maxPages = 50) {
  const found: SearchRow[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await search(params, String(page), "96");
    found.push(...result.data);
    if (page >= result.meta.totalPages) break;
  }
  return found;
}

async function ids(params: Record<string, string>) {
  return (await rows(params)).map((row) => row.id);
}

/** Upper-case alphanumeric tokens of a title (`G90/G99` -> `G90`, `G99`). */
function titleTokens(value: string) {
  return value.toUpperCase().split(/[^A-Z0-9.]+/).map((token) => token.replace(/\.+$/, ""));
}

/** The title names the make, every model word and the chassis as whole tokens. */
function titleNamesVehicle(title: string, make: string, model: string, chassis: string) {
  const tokens = new Set(titleTokens(title));
  const words = (value: string) => titleTokens(value).filter(Boolean);
  return (
    words(make).every((word) => tokens.has(word)) &&
    words(model).every((word) => tokens.has(word)) &&
    words(chassis).every((word) => tokens.has(word))
  );
}

type Report = {
  make: string;
  models: number;
  chassisOptions: number;
  deadModels: string[];
  deadChassis: string[];
  titleMisses: string[];
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
    titleMisses: [],
  };
  await pool(models, async (model) => {
    if ((await total({ make, model })) === 0) report.deadModels.push(model);
    const chassis = (await fitment({ make, model })).data;
    report.chassisOptions += chassis.length;
    for (const code of chassis) {
      if (!checkTitles) {
        if ((await total({ make, model, chassis: code })) === 0) {
          report.deadChassis.push(`${model} / ${code}`);
        }
        continue;
      }
      const listed = await rows({ make, model, chassis: code });
      if (listed.length === 0) report.deadChassis.push(`${model} / ${code}`);
      const listedIds = new Set(listed.map((row) => row.id));
      const named = (await rows({ q: `${make} ${model} ${code}` }, 10)).filter((row) =>
        titleNamesVehicle(row.name ?? "", make, model, code)
      );
      for (const row of named) {
        if (!listedIds.has(row.id)) {
          report.titleMisses.push(`${model} / ${code}: [${row.brand}] ${row.name} (${row.id})`);
        }
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
    if (checkTitles) console.log(`  title misses: ${report.titleMisses.length}`);
    for (const line of report.titleMisses) console.log(`  TITLE MISS   ${line}`);
  }
  const dead = reports.reduce((sum, r) => sum + r.deadModels.length + r.deadChassis.length, 0);
  console.log(`\n${reports.length} makes, ${dead} dead-end options`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(reports, null, 1));
  process.exitCode = dead ? 1 : 0;
}

void main();
