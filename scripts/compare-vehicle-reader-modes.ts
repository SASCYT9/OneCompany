/**
 * Read-only comparison of the legacy vehicle reader (A, e.g. production) with
 * the projection reader (B, e.g. a Preview that sets
 * SHOP_CATALOG_V2_VEHICLE_READER_MODE=projection). GET requests only,
 * concurrency 3.
 *
 *   npx tsx scripts/compare-vehicle-reader-modes.ts <urlA> <urlB> [--makes "Porsche|BMW"] [--json out.json]
 *
 * For every make -> model -> chassis combination offered by A's picker it
 * compares the product sets both readers return and reports products only A
 * shows (`lost`) and only B shows (`gained`). Exit code 1 when B loses
 * products or offers a picker option that opens nothing.
 */
import fs from "node:fs";

const CONCURRENCY = 3;
const args = process.argv.slice(2);
const urls = args.filter((arg) => /^https?:\/\//.test(arg)).map((arg) => arg.replace(/\/$/, ""));
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : null;
};
const makesArg = flag("--makes");
const jsonOut = flag("--json");
if (urls.length !== 2) {
  console.error(
    'usage: compare-vehicle-reader-modes.ts <urlA legacy> <urlB projection> [--makes "A|B"] [--json out]'
  );
  process.exit(2);
}
const [baseA, baseB] = urls as [string, string];

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

type Search = { data: { id: string }[]; meta: { totalItems: number; totalPages: number } };
const search = (base: string, params: Record<string, string>, page = "1", limit = "1") =>
  getJson<Search>(
    `${base}/api/shop/stock/search?${new URLSearchParams({ locale: "ua", scope: "auto", page, limit, ...params })}`
  );
const options = (base: string, params: Record<string, string>) =>
  getJson<{ data: string[] }>(
    `${base}/api/shop/stock/fitment?${new URLSearchParams({ scope: "auto", ...params })}`
  );

async function ids(base: string, params: Record<string, string>) {
  const found = new Set<string>();
  for (let page = 1; ; page += 1) {
    const result = await search(base, params, String(page), "96");
    for (const row of result.data) found.add(row.id);
    if (page >= result.meta.totalPages) return found;
  }
}

type Row = {
  query: Record<string, string>;
  a: number;
  b: number;
  lost: number;
  gained: number;
};

async function compare(query: Record<string, string>): Promise<Row> {
  const [a, b] = await Promise.all([search(baseA, query), search(baseB, query)]);
  const row: Row = {
    query,
    a: a.meta.totalItems,
    b: b.meta.totalItems,
    lost: 0,
    gained: 0,
  };
  if (row.a !== row.b || row.a > 0) {
    const [setA, setB] = await Promise.all([ids(baseA, query), ids(baseB, query)]);
    row.lost = [...setA].filter((id) => !setB.has(id)).length;
    row.gained = [...setB].filter((id) => !setA.has(id)).length;
    row.a = setA.size;
    row.b = setB.size;
  }
  return row;
}

async function main() {
  const makes = makesArg
    ? makesArg
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean)
    : // B-only makes must be audited too: every option B offers has to open results.
      [...new Set([...(await options(baseA, {})).data, ...(await options(baseB, {})).data])];
  const rows: Row[] = [];
  const deadInB: string[] = [];
  for (const make of makes) {
    const combos: Record<string, string>[] = [{ make }];
    for (const model of (await options(baseA, { make })).data) {
      combos.push({ make, model });
      for (const chassis of (await options(baseA, { make, model })).data) {
        combos.push({ make, model, chassis });
      }
    }
    // Options B itself offers must open something.
    const optionsB = (await options(baseB, { make })).data;
    await pool(combos, async (query) => {
      rows.push(await compare(query));
    });
    await pool(optionsB, async (model) => {
      if ((await search(baseB, { make, model })).meta.totalItems === 0) {
        deadInB.push(`${make} / ${model}`);
      }
      // ...and so must every chassis B offers for that model.
      for (const chassis of (await options(baseB, { make, model })).data) {
        if ((await search(baseB, { make, model, chassis })).meta.totalItems === 0) {
          deadInB.push(`${make} / ${model} / ${chassis}`);
        }
      }
    });
    const mine = rows.filter((row) => row.query.make === make);
    const lost = mine.reduce((sum, row) => sum + row.lost, 0);
    const gained = mine.reduce((sum, row) => sum + row.gained, 0);
    console.log(`${make}: ${mine.length} queries, lost ${lost}, gained ${gained}`);
    for (const row of mine.filter((item) => item.lost > 0)) {
      console.log(
        `  LOST ${row.lost}  ${Object.values(row.query).join(" / ")}  (A ${row.a}, B ${row.b})`
      );
    }
  }
  for (const line of deadInB) console.log(`DEAD IN B  ${line}`);
  const lostTotal = rows.reduce((sum, row) => sum + row.lost, 0);
  console.log(`\n${rows.length} queries, lost ${lostTotal}, dead options in B ${deadInB.length}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ rows, deadInB }, null, 1));
  process.exitCode = lostTotal || deadInB.length ? 1 : 0;
}

void main();
