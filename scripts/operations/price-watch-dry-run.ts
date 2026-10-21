/**
 * Runs the supplier price checks once WITHOUT writing anything and saves what
 * the «Работа → Цены» page and the bot would show, for the local preview
 * (OPS_LOCAL_DEMO_MODE=true reads the file). Our prices are read from the
 * database of the env file with one connection; suppliers' public pages are
 * read one at a time with a pause.
 *
 *   npx tsx --env-file=.env.local --conditions=react-server scripts/operations/price-watch-dry-run.ts
 *   … --sources=ct-carbon,link-ecu      only these sources (default: every automatic one)
 *   … --out=.tmp/price-watch-demo.json  where to save
 *   … --delay=900                       pause between supplier pages, ms
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  buildPriceWatchOverview,
  initialPriceListDates,
  preparePriceWatchRun,
  publishedProductsByBrand,
  summarizePriceWatchFacts,
  type PriceWatchFactsSummary,
  type PriceWatchOverviewRow,
  type PriceWatchRunRow,
} from "../../src/lib/operations/priceWatch";
import {
  describePriceWatchError,
  runPriceWatchStep,
  type PriceWatchCheckResult,
  type PriceWatchFact,
  type PriceWatchProgress,
} from "../../src/lib/operations/priceWatchChecks";
import { PRICE_WATCH_SOURCES } from "../../src/lib/operations/priceWatchSources";

const argument = (name: string) =>
  process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = argument("sources")
  ?.split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const outPath = resolve(argument("out") ?? ".tmp/price-watch-demo.json");
/** Pause between supplier pages; the cron uses 900 ms. */
const delayMs = Number(argument("delay") ?? 900);

function oneConnection(url: string | undefined) {
  if (!url) throw new Error("DIRECT_URL or DATABASE_URL is required");
  const parsed = new URL(url);
  parsed.searchParams.set("connection_limit", "1");
  parsed.searchParams.set("pool_timeout", "30");
  return parsed.toString();
}

const client = new PrismaClient({
  datasourceUrl: oneConnection(process.env.DIRECT_URL || process.env.DATABASE_URL),
});

async function main() {
  const now = new Date();
  const rows: PriceWatchOverviewRow[] = [];
  const runs: PriceWatchRunRow[] = [];
  const factSummaries: PriceWatchFactsSummary[] = [];
  for (const def of PRICE_WATCH_SOURCES) {
    const row: PriceWatchOverviewRow = {
      key: def.key,
      state: null,
      lastFinishedAt: null,
      lastStatus: null,
      ...initialPriceListDates(def),
    };
    rows.push(row);
    if (!def.check || (only && !only.includes(def.key))) continue;
    const startedAt = Date.now();
    let progress: PriceWatchProgress | null = null;
    let result: PriceWatchCheckResult;
    const facts: PriceWatchFact[] = [];
    try {
      for (;;) {
        const step = await runPriceWatchStep(
          def,
          {
            client,
            fetchImpl: fetch,
            now,
            deadline: Number.MAX_SAFE_INTEGER,
            delayMs,
            previousSnapshot: null,
          },
          progress
        );
        if (step.done) {
          result = step.result;
          facts.push(...(step.result.facts ?? []));
          break;
        }
        progress = step.progress;
        facts.push(...(step.facts ?? []));
        console.log(`  ${def.key}: ${progress.offset} pages…`);
      }
    } catch (error) {
      result = {
        status: "error",
        checked: 0,
        findings: [],
        summary: { error: describePriceWatchError(error) },
      };
    }
    const prepared = preparePriceWatchRun({ def, result, previous: null });
    if (facts.length) factSummaries.push(summarizePriceWatchFacts(def.key, facts));
    const finishedAt = new Date();
    row.lastFinishedAt = finishedAt;
    row.lastStatus = prepared.status;
    runs.push({
      sourceKey: def.key,
      status: prepared.status,
      checked: result.checked,
      findingsCount: prepared.findingsCount,
      newFindings: prepared.newFindings,
      summary: JSON.parse(JSON.stringify(prepared.summary)),
      findings: JSON.parse(JSON.stringify(prepared.findings)),
      finishedAt,
    });
    console.log(
      `${def.key}: ${prepared.status} · ${result.checked} products · ${prepared.findingsCount} findings · ${Math.round(
        (Date.now() - startedAt) / 1000
      )} s${prepared.summary.error ? ` · ${prepared.summary.error}` : ""}`
    );
  }
  const productsByBrand = await publishedProductsByBrand(client);
  // A first look has no "new at the supplier" yet: those appear from the second check.
  const overview = buildPriceWatchOverview({
    now,
    rows,
    runs,
    productsByBrand,
    facts: { summaries: factSummaries, newItems: [] },
    demo: true,
  });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(overview, null, 1));
  console.log(`saved ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
