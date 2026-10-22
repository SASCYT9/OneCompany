import { randomUUID } from "node:crypto";

import {
  OpsJobStage,
  OpsJobStatus,
  OpsPriority,
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  Prisma,
  ShopCatalogStatus,
  type OpsPriceWatchRun,
  type OpsPriceWatchSource,
  type PrismaClient,
} from "@prisma/client";

import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import { opsAdminLink } from "@/lib/operations/adminLinks";
import { createOpsExternalId } from "@/lib/operations/ids";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";
import { opsGetsOwnerReports } from "@/lib/operations/ownerReports";
import {
  describePriceWatchError,
  parsePriceWatchProgress,
  pausePriceWatchProgress,
  priceWatchFindingKey,
  runPriceWatchStep,
  type PriceWatchCheckResult,
  type PriceWatchFact,
  type PriceWatchFinding,
  type PriceWatchStatus,
  type PriceWatchSummary,
} from "@/lib/operations/priceWatchChecks";
import {
  isPriceWatchEntryReportable,
  priceListReminderButtons,
  priceWatchDigestButtons,
  renderPriceListReminder,
  renderPriceWatchDigest,
  renderPriceWatchTaskDescription,
  systemicPriceWatchDifference,
  type PriceWatchButtonSpec,
  type PriceWatchDigestEntry,
  type PriceWatchPriceListLine,
} from "@/lib/operations/priceWatchReport";
import {
  findPriceWatchSource,
  PRICE_WATCH_SOURCES,
  type PriceWatchKind,
  type PriceWatchSourceDefinition,
} from "@/lib/operations/priceWatchSources";
import {
  addOpsLocalDays,
  isWithinOpsNotifyWindow,
  opsLocalClock,
  opsLocalTime,
  type OpsReminderMember,
} from "@/lib/operations/reminders";

/**
 * Supplier price watch: hourly checks (src/app/api/cron/price-watch), a daily
 * owner digest at 10:00 only when there is news, a Monday overview, and gentle
 * price-list reminders (on the due day and once more a week later). Nothing
 * here changes prices on the site.
 */

export const PRICE_WATCH_DIGEST_HOUR = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 6 * 60 * 1000;
const RETRY_AFTER_ERROR_HOURS = 3;
const RUN_RETENTION_DAYS = 120;
const REMINDER_ROUNDS = 2;
const TASK_SNOOZE_DAYS = 14;

export function isPriceWatchEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return !/^(0|false|off|no)$/i.test(String(environment.OPS_PRICE_WATCH_ENABLED ?? "").trim());
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function findingsOf(value: unknown): PriceWatchFinding[] {
  return Array.isArray(value) ? (value as PriceWatchFinding[]) : [];
}

function summaryOf(value: unknown): PriceWatchSummary {
  return (value && typeof value === "object" ? value : {}) as PriceWatchSummary;
}

function snapshotOf(value: unknown): Record<string, number> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, number>)
    : null;
}

export function initialPriceListDates(def: PriceWatchSourceDefinition) {
  if (!def.priceList) return { priceListDate: null, nextReminderAt: null };
  const priceListDate = new Date(`${def.priceList.date}T00:00:00.000Z`);
  return {
    priceListDate,
    nextReminderAt: new Date(priceListDate.getTime() + def.priceList.everyDays * DAY_MS),
  };
}

export async function ensurePriceWatchSources(client: Pick<PrismaClient, "opsPriceWatchSource">) {
  await client.opsPriceWatchSource.createMany({
    data: PRICE_WATCH_SOURCES.map((def) => ({ key: def.key, ...initialPriceListDates(def) })),
    skipDuplicates: true,
  });
  return client.opsPriceWatchSource.findMany();
}

type SourceTiming = Pick<OpsPriceWatchSource, "state" | "lastFinishedAt" | "lastStatus">;

export function isPriceWatchDue(def: PriceWatchSourceDefinition, row: SourceTiming, now: Date) {
  if (!def.check) return false;
  if (row.state) return true;
  if (!row.lastFinishedAt) return true;
  const hours =
    row.lastStatus === "error"
      ? Math.min(RETRY_AFTER_ERROR_HOURS, def.everyHours ?? 24)
      : (def.everyHours ?? 24);
  // Ten minutes of slack keep an hourly cron from drifting a whole hour later each day.
  return now.getTime() - row.lastFinishedAt.getTime() >= hours * 3_600_000 - 10 * 60_000;
}

export function nextPriceWatchCheckAt(def: PriceWatchSourceDefinition, row: SourceTiming) {
  if (!def.check || !row.lastFinishedAt) return null;
  const hours =
    row.lastStatus === "error"
      ? Math.min(RETRY_AFTER_ERROR_HOURS, def.everyHours ?? 24)
      : (def.everyHours ?? 24);
  return new Date(row.lastFinishedAt.getTime() + hours * 3_600_000);
}

/** Marks findings the previous check did not have, and notes a VAT switch of the feed. */
export function preparePriceWatchRun(input: {
  def: PriceWatchSourceDefinition;
  result: PriceWatchCheckResult;
  previous: { findings: unknown; summary: unknown } | null;
}) {
  const known = new Set(findingsOf(input.previous?.findings).map(priceWatchFindingKey));
  // A first look only remembers: what is missing then is not news later.
  const baseline = input.result.status === "baseline";
  const findings = input.result.findings.map((finding) => ({
    ...finding,
    isNew: !baseline && !known.has(priceWatchFindingKey(finding)),
  }));
  const summary: PriceWatchSummary = { ...input.result.summary };
  let status: PriceWatchStatus = input.result.status;
  // The CT Carbon import (20.10.2026) read the feed without VAT.
  const previousVat =
    summaryOf(input.previous?.summary).feedVat ??
    (input.def.check === "ct-carbon" ? "excluded" : undefined);
  if (summary.feedVat && previousVat && summary.feedVat !== previousVat) {
    summary.notice =
      summary.feedVat === "included"
        ? `в фиде ${input.def.site} цены теперь с НДС — учёл это, сравниваю по цене с НДС`
        : `в фиде ${input.def.site} цены теперь без НДС — учёл это, добавляю НДС сам`;
    if (status === "ok" || status === "findings") status = "format_change";
  }
  const counts = summary.counts ?? {};
  const findingsCount = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  return {
    status,
    summary,
    findings,
    findingsCount: Math.max(findingsCount, findings.length),
    newFindings: findings.filter((finding) => finding.isNew).length,
  };
}

const FACTS_PER_STATEMENT = 500;
const FACT_RETENTION_DAYS = 60;

/**
 * Saves what the supplier showed (one statement per 500 items) and returns the
 * items that were out of stock at the previous check and are buyable again.
 * `keepStored`: facts from data kept at import only fill gaps, so a newer price
 * list sent to the bot is not overwritten by the import-time copy.
 * `firstSeenAt`: for items saved for the first time, so a source's first price
 * list does not report every item as new.
 */
export async function savePriceWatchFacts(
  client: Pick<PrismaClient, "opsSupplierItem" | "$executeRaw">,
  sourceKey: string,
  facts: readonly PriceWatchFact[],
  options: { now?: Date; keepStored?: boolean; firstSeenAt?: Date } = {}
) {
  const now = options.now ?? new Date();
  const firstSeenAt = options.firstSeenAt ?? now;
  // Column names below are constants, never input.
  const stored = (column: string) =>
    Prisma.raw(`COALESCE("OpsSupplierItem"."${column}", EXCLUDED."${column}")`);
  const value = options.keepStored
    ? stored
    : (column: string) => Prisma.raw(`EXCLUDED."${column}"`);
  const measure = options.keepStored
    ? stored
    : (column: string) =>
        Prisma.raw(`COALESCE(EXCLUDED."${column}", "OpsSupplierItem"."${column}")`);
  const backInStock: PriceWatchFact[] = [];
  const unique = [...new Map(facts.map((fact) => [fact.supplierKey, fact])).values()];
  for (let index = 0; index < unique.length; index += FACTS_PER_STATEMENT) {
    const chunk = unique.slice(index, index + FACTS_PER_STATEMENT);
    const before = await client.opsSupplierItem.findMany({
      where: {
        sourceKey,
        supplierKey: { in: chunk.map((fact) => fact.supplierKey) },
        available: false,
      },
      select: { supplierKey: true },
    });
    const wasOut = new Set(before.map((row) => row.supplierKey));
    for (const fact of chunk) {
      if (fact.productId && fact.available === true && wasOut.has(fact.supplierKey))
        backInStock.push(fact);
    }
    const rows = JSON.stringify(
      chunk.map((fact) => ({
        id: randomUUID(),
        supplierKey: fact.supplierKey,
        productId: fact.productId,
        variantId: fact.variantId,
        sku: fact.sku,
        supplierSku: fact.supplierSku,
        title: fact.title.slice(0, 500),
        url: fact.url,
        price: fact.price,
        currency: fact.currency,
        available: fact.available,
        availability: fact.availability,
        weightKg: fact.weightKg,
        lengthCm: fact.lengthCm ?? null,
        widthCm: fact.widthCm ?? null,
        heightCm: fact.heightCm ?? null,
      }))
    );
    await client.$executeRaw`
      INSERT INTO "OpsSupplierItem" ("id", "sourceKey", "supplierKey", "productId", "variantId", "sku",
        "supplierSku", "title", "url", "price", "currency", "available", "availability", "weightKg",
        "lengthCm", "widthCm", "heightCm", "firstSeenAt", "lastSeenAt", "updatedAt")
      SELECT x."id", ${sourceKey}, x."supplierKey", x."productId", x."variantId", x."sku", x."supplierSku",
        x."title", x."url", x."price", x."currency", x."available", x."availability", x."weightKg",
        x."lengthCm", x."widthCm", x."heightCm", ${firstSeenAt}, ${now}, ${now}
      FROM jsonb_to_recordset(${rows}::jsonb) AS x("id" text, "supplierKey" text, "productId" text,
        "variantId" text, "sku" text, "supplierSku" text, "title" text, "url" text, "price" numeric,
        "currency" text, "available" boolean, "availability" text, "weightKg" numeric,
        "lengthCm" numeric, "widthCm" numeric, "heightCm" numeric)
      ON CONFLICT ("sourceKey", "supplierKey") DO UPDATE SET
        "productId" = EXCLUDED."productId",
        "variantId" = EXCLUDED."variantId",
        "sku" = EXCLUDED."sku",
        "supplierSku" = ${value("supplierSku")},
        "title" = ${value("title")},
        "url" = ${value("url")},
        "price" = ${value("price")},
        "currency" = ${value("currency")},
        "available" = ${value("available")},
        "availability" = ${value("availability")},
        "weightKg" = ${measure("weightKg")},
        "lengthCm" = ${measure("lengthCm")},
        "widthCm" = ${measure("widthCm")},
        "heightCm" = ${measure("heightCm")},
        "lastSeenAt" = EXCLUDED."lastSeenAt",
        "updatedAt" = EXCLUDED."updatedAt"`;
  }
  return backInStock;
}

/** "Back in stock" findings, added to a check's own findings. */
export function backInStockFindings(facts: readonly PriceWatchFact[]): PriceWatchFinding[] {
  return facts.map((fact) => ({
    kind: "back_in_stock",
    sku: fact.sku ?? fact.supplierSku ?? fact.supplierKey,
    title: fact.title,
    url: fact.url,
    currency: fact.currency ?? "EUR",
  }));
}

function withExtraFindings(result: PriceWatchCheckResult, extra: PriceWatchFinding[]) {
  if (!extra.length) return result;
  const counts = { ...result.summary.counts };
  for (const finding of extra) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  return {
    ...result,
    status: result.status === "ok" ? ("findings" as const) : result.status,
    findings: [...result.findings, ...extra],
    summary: { ...result.summary, counts },
  };
}

async function recordPriceWatchRun(input: {
  client: PrismaClient;
  row: OpsPriceWatchSource;
  def: PriceWatchSourceDefinition;
  result: PriceWatchCheckResult;
  startedAt: Date;
}) {
  const previous = await input.client.opsPriceWatchRun.findFirst({
    where: { sourceId: input.row.id },
    orderBy: { finishedAt: "desc" },
    select: { findings: true, summary: true },
  });
  const prepared = preparePriceWatchRun({ def: input.def, result: input.result, previous });
  const finishedAt = new Date();
  await input.client.opsPriceWatchRun.create({
    data: {
      sourceId: input.row.id,
      status: prepared.status,
      startedAt: input.startedAt,
      finishedAt,
      checked: input.result.checked,
      findingsCount: prepared.findingsCount,
      newFindings: prepared.newFindings,
      summary: asJson(prepared.summary),
      findings: asJson(prepared.findings),
    },
  });
  await input.client.opsPriceWatchSource.update({
    where: { id: input.row.id },
    data: {
      state: Prisma.DbNull,
      leaseUntil: null,
      lastFinishedAt: finishedAt,
      lastStatus: prepared.status,
      lastError: prepared.status === "error" ? (prepared.summary.error ?? null) : null,
      ...(input.result.snapshot ? { snapshot: asJson(input.result.snapshot) } : {}),
    },
  });
  return prepared;
}

/**
 * One cron run: checks the sources that are due, a page source continues where
 * it stopped. Every source is leased, so overlapping runs never check twice.
 */
export async function runPriceWatch(input: {
  client: PrismaClient;
  now?: Date;
  budgetMs?: number;
  fetchImpl?: typeof fetch;
  delayMs?: number;
  only?: readonly string[];
}) {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const deadline = startedAt + (input.budgetMs ?? 240_000);
  const rows = await ensurePriceWatchSources(input.client);
  const due = PRICE_WATCH_SOURCES.filter((def) => !input.only || input.only.includes(def.key))
    .map((def) => ({ def, row: rows.find((row) => row.key === def.key) }))
    .filter(
      (entry): entry is { def: PriceWatchSourceDefinition; row: OpsPriceWatchSource } =>
        Boolean(entry.row) && isPriceWatchDue(entry.def, entry.row!, now)
    )
    .sort(
      (left, right) =>
        Number(Boolean(right.row.state)) - Number(Boolean(left.row.state)) ||
        (left.row.lastFinishedAt?.getTime() ?? 0) - (right.row.lastFinishedAt?.getTime() ?? 0)
    );
  const sources: Array<{
    key: string;
    status: string;
    findings?: number;
    newFindings?: number;
    error?: string;
  }> = [];
  for (const { def, row } of due) {
    // A feed takes up to a minute; never start one that could outlive the function.
    if (Date.now() > deadline - 60_000) break;
    const claimed = await input.client.opsPriceWatchSource.updateMany({
      where: { id: row.id, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      data: {
        leaseUntil: new Date(Date.now() + LEASE_MS),
        ...(row.state ? {} : { lastStartedAt: new Date() }),
      },
    });
    if (claimed.count !== 1) continue;
    const progress = parsePriceWatchProgress(row.state);
    const checkStartedAt = progress ? new Date(progress.startedAt) : new Date();
    try {
      const step = await runPriceWatchStep(
        def,
        {
          client: input.client,
          fetchImpl: input.fetchImpl ?? fetch,
          now,
          // A slow page (3 tries × 20 s) must still finish inside the run.
          deadline: deadline - 75_000,
          delayMs: input.delayMs ?? 900,
          previousSnapshot: snapshotOf(row.snapshot),
        },
        progress
      );
      // Stock and weight are saved as they are read, so a long check keeps them.
      const facts = step.done ? (step.result.facts ?? []) : (step.facts ?? []);
      const backInStock = backInStockFindings(
        facts.length
          ? await savePriceWatchFacts(input.client, def.key, facts, {
              keepStored: def.check === "import-facts",
            })
          : []
      );
      if (!step.done) {
        await input.client.opsPriceWatchSource.update({
          where: { id: row.id },
          data: {
            state: asJson({
              ...step.progress,
              pauses: 0,
              findings: [...step.progress.findings, ...backInStock],
            }),
            leaseUntil: null,
          },
        });
        sources.push({ key: def.key, status: "in_progress" });
        continue;
      }
      const run = await recordPriceWatchRun({
        client: input.client,
        row,
        def,
        result: withExtraFindings({ ...step.result, facts: undefined }, backInStock),
        startedAt: checkStartedAt,
      });
      await input.client.opsSupplierItem.deleteMany({
        where: {
          sourceKey: def.key,
          lastSeenAt: { lt: new Date(now.getTime() - FACT_RETENTION_DAYS * DAY_MS) },
        },
      });
      sources.push({
        key: def.key,
        status: run.status,
        findings: run.findingsCount,
        newFindings: run.newFindings,
      });
    } catch (error) {
      const message = describePriceWatchError(error);
      console.error("[operations.price-watch] check failed", { source: def.key, error: message });
      // A week of page checks is not thrown away because the site refused for a while.
      const paused = pausePriceWatchProgress(def, progress);
      if (paused) {
        await input.client.opsPriceWatchSource.update({
          where: { id: row.id },
          data: { state: asJson(paused), leaseUntil: null, lastError: message },
        });
        sources.push({ key: def.key, status: "paused", error: message });
        continue;
      }
      await recordPriceWatchRun({
        client: input.client,
        row,
        def,
        result: { status: "error", checked: 0, findings: [], summary: { error: message } },
        startedAt: checkStartedAt,
      });
      sources.push({ key: def.key, status: "error", error: message });
    }
  }
  const pruned = await input.client.opsPriceWatchRun.deleteMany({
    where: { finishedAt: { lt: new Date(now.getTime() - RUN_RETENTION_DAYS * DAY_MS) } },
  });
  return { sources, prunedRuns: pruned.count, durationMs: Date.now() - startedAt };
}

// ---------------------------------------------------------------------------
// Reading results
// ---------------------------------------------------------------------------

export type PriceWatchRunRow = Pick<
  OpsPriceWatchRun,
  "status" | "checked" | "findingsCount" | "newFindings" | "summary" | "findings" | "finishedAt"
> & { sourceKey: string };
type RunRow = PriceWatchRunRow;

/** The newest run of each source, optionally only runs finished after `since`. */
async function latestPriceWatchRuns(client: PrismaClient, since?: Date): Promise<RunRow[]> {
  const ids = await client.$queryRaw<Array<{ id: string }>>(
    since
      ? Prisma.sql`SELECT DISTINCT ON ("sourceId") "id" FROM "OpsPriceWatchRun" WHERE "finishedAt" > ${since} ORDER BY "sourceId", "finishedAt" DESC`
      : Prisma.sql`SELECT DISTINCT ON ("sourceId") "id" FROM "OpsPriceWatchRun" ORDER BY "sourceId", "finishedAt" DESC`
  );
  if (!ids.length) return [];
  const runs = await client.opsPriceWatchRun.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    select: {
      status: true,
      checked: true,
      findingsCount: true,
      newFindings: true,
      summary: true,
      findings: true,
      finishedAt: true,
      source: { select: { key: true } },
    },
  });
  return runs.map(({ source, ...run }) => ({ ...run, sourceKey: source.key }));
}

export function toPriceWatchDigestEntry(
  def: PriceWatchSourceDefinition,
  run: Omit<RunRow, "sourceKey">
): PriceWatchDigestEntry {
  return {
    key: def.key,
    title: def.title,
    kind: def.kind,
    site: def.site,
    status: run.status as PriceWatchStatus,
    checked: run.checked,
    findingsCount: run.findingsCount,
    newFindings: run.newFindings,
    findings: findingsOf(run.findings),
    summary: summaryOf(run.summary),
  };
}

function entriesFromRuns(runs: RunRow[]) {
  return PRICE_WATCH_SOURCES.flatMap((def) => {
    const run = runs.find((entry) => entry.sourceKey === def.key);
    return run ? [toPriceWatchDigestEntry(def, run)] : [];
  });
}

async function publishedProductsByBrand(client: Pick<PrismaClient, "shopProduct">) {
  const groups = await client.shopProduct.groupBy({
    by: ["brand"],
    where: { status: ShopCatalogStatus.ACTIVE, isPublished: true },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.brand ?? "", group._count._all]));
}

export function priceWatchProductCount(
  def: PriceWatchSourceDefinition,
  productsByBrand: ReadonlyMap<string, number>
) {
  return def.brands.reduce((sum, brand) => sum + (productsByBrand.get(brand) ?? 0), 0);
}

export function priceWatchPriceListLines(
  rows: ReadonlyArray<Pick<OpsPriceWatchSource, "key" | "nextReminderAt">>,
  now: Date
): PriceWatchPriceListLine[] {
  return PRICE_WATCH_SOURCES.filter((def) => def.priceList).map((def) => {
    const row = rows.find((entry) => entry.key === def.key);
    const nextReminderAt = row?.nextReminderAt ?? initialPriceListDates(def).nextReminderAt;
    return {
      title: def.title,
      nextReminderAt: nextReminderAt?.toISOString() ?? null,
      overdue: Boolean(nextReminderAt && nextReminderAt.getTime() <= now.getTime()),
    };
  });
}

/** Per source: how much we know from the supplier (for us only). */
export type PriceWatchFactsSummary = {
  sourceKey: string;
  matched: number;
  withWeight: number;
  /** With box size (Dinan / APR price lists), for the shipping calculator. */
  withSize: number;
  /** With stock the supplier publishes (price lists and dealer-only sites have none). */
  withStock: number;
  outOfStock: number;
  supplierOnly: number;
};

/** A price change made from Telegram, for the «Цены» page. */
export type PriceWatchRecentChange = {
  id: string;
  title: string;
  origin: string;
  status: string;
  itemCount: number;
  appliedCount: number;
  failedCount: number;
  requestedBy: string;
  createdAt: string;
  appliedAt: string | null;
};

export type PriceWatchNewItem = {
  sourceKey: string;
  title: string;
  url: string | null;
  price: number | null;
  currency: string | null;
  firstSeenAt: string;
};

/** Gift cards, clothing and services are not products we would import. */
const NOT_A_PRODUCT =
  /gift\s*card|подарунков|сертифікат|t-?shirt|hoodie|\bcap\b|beanie|sticker|key\s*ring|keyring|\bmug\b|poster|fitting|installation|service|warranty|shipping|deposit/i;

export function isImportCandidate(item: Pick<PriceWatchNewItem, "title" | "price">) {
  return Boolean(item.price && item.price > 0) && !NOT_A_PRODUCT.test(item.title);
}

export async function loadPriceWatchFacts(client: PrismaClient, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [summaries, fresh] = await Promise.all([
    client.$queryRaw<
      Array<{
        sourceKey: string;
        matched: bigint;
        withWeight: bigint;
        withSize: bigint;
        withStock: bigint;
        outOfStock: bigint;
        supplierOnly: bigint;
      }>
    >`SELECT "sourceKey",
        COUNT(*) FILTER (WHERE "productId" IS NOT NULL) AS "matched",
        COUNT(*) FILTER (WHERE "productId" IS NOT NULL AND "weightKg" IS NOT NULL) AS "withWeight",
        COUNT(*) FILTER (WHERE "productId" IS NOT NULL AND "lengthCm" IS NOT NULL) AS "withSize",
        COUNT(*) FILTER (WHERE "productId" IS NOT NULL AND "available" IS NOT NULL) AS "withStock",
        COUNT(*) FILTER (WHERE "productId" IS NOT NULL AND "available" = false) AS "outOfStock",
        COUNT(*) FILTER (WHERE "productId" IS NULL) AS "supplierOnly"
      FROM "OpsSupplierItem" GROUP BY "sourceKey"`,
    // New at the supplier: seen for the first time this week, not at the source's first check.
    client.$queryRaw<
      Array<{
        sourceKey: string;
        title: string;
        url: string | null;
        price: Prisma.Decimal | null;
        currency: string | null;
        firstSeenAt: Date;
      }>
    >`SELECT i."sourceKey", i."title", i."url", i."price", i."currency", i."firstSeenAt"
      FROM "OpsSupplierItem" i
      JOIN (SELECT "sourceKey", MIN("firstSeenAt") AS "firstCheck" FROM "OpsSupplierItem" GROUP BY "sourceKey") s
        ON s."sourceKey" = i."sourceKey"
      WHERE i."productId" IS NULL
        AND i."available" IS DISTINCT FROM false
        AND i."firstSeenAt" > ${weekAgo}
        AND i."firstSeenAt" > s."firstCheck" + interval '1 hour'
      ORDER BY i."firstSeenAt" DESC
      LIMIT 400`,
  ]);
  return {
    summaries: summaries.map((row) => ({
      sourceKey: row.sourceKey,
      matched: Number(row.matched),
      withWeight: Number(row.withWeight),
      withSize: Number(row.withSize),
      withStock: Number(row.withStock),
      outOfStock: Number(row.outOfStock),
      supplierOnly: Number(row.supplierOnly),
    })) satisfies PriceWatchFactsSummary[],
    newItems: fresh
      .map((row) => ({
        sourceKey: row.sourceKey,
        title: row.title,
        url: row.url,
        price: row.price === null ? null : Number(row.price),
        currency: row.currency,
        firstSeenAt: row.firstSeenAt.toISOString(),
      }))
      .filter(isImportCandidate) satisfies PriceWatchNewItem[],
  };
}

/** Weekly lines: what is new at suppliers and what the manufacturers lack, by source title. */
export function priceWatchWeeklyFactLines(facts: {
  summaries: PriceWatchFactsSummary[];
  newItems: PriceWatchNewItem[];
}) {
  const title = (key: string) => findPriceWatchSource(key)?.title ?? key;
  const counts = new Map<string, number>();
  for (const item of facts.newItems)
    counts.set(item.sourceKey, (counts.get(item.sourceKey) ?? 0) + 1);
  return {
    newItems: [...counts.entries()].map(([key, count]) => ({ title: title(key), count })),
    stock: facts.summaries
      .filter((row) => findPriceWatchSource(row.sourceKey)?.kind !== "competitor")
      .map((row) => ({ title: title(row.sourceKey), outOfStock: row.outOfStock })),
  };
}

export function priceWatchPlannedLine(productsByBrand: ReadonlyMap<string, number>) {
  const planned = PRICE_WATCH_SOURCES.filter((def) => def.kind === "planned");
  return {
    titles: planned.map((def) => def.title),
    products: planned.reduce((sum, def) => sum + priceWatchProductCount(def, productsByBrand), 0),
  };
}

// ---------------------------------------------------------------------------
// Telegram: queueing and building messages
// ---------------------------------------------------------------------------

/**
 * Owners get the digest at 10:00 local when something is new (always on
 * Mondays) and the price-list reminders that are due.
 */
export async function enqueuePriceWatchNotifications(input: {
  client: PrismaClient;
  now: Date;
  member: OpsReminderMember;
  lastLoginAt: Date | null;
}) {
  const { client, now, member } = input;
  const result = { digests: 0, reminders: 0 };
  if (
    !opsGetsOwnerReports({ roles: member.roles, lastLoginAt: input.lastLoginAt, now }) ||
    !isWithinOpsNotifyWindow(now, member.timezone)
  ) {
    return result;
  }
  const clock = opsLocalClock(now, member.timezone);
  if (clock.hour !== PRICE_WATCH_DIGEST_HOUR) return result;
  const base = {
    recipientAdminUserId: member.adminUserId,
    telegramUserId: member.telegramUserId.toString(),
  };
  const digestKey = `price:digest:${member.adminUserId}:${clock.date}`;
  const lastDigest = await client.opsJob.findFirst({
    where: { idempotencyKey: { startsWith: `price:digest:${member.adminUserId}:` } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, idempotencyKey: true },
  });
  if (lastDigest?.idempotencyKey !== digestKey) {
    const since = lastDigest?.createdAt ?? new Date(now.getTime() - 7 * DAY_MS);
    const weekly = clock.weekday === 1;
    const news = weekly
      ? 1
      : await client.opsPriceWatchRun.count({
          where: {
            finishedAt: { gt: since },
            OR: [
              { newFindings: { gt: 0 } },
              { status: { in: ["error", "format_change", "mass_change"] } },
            ],
          },
        });
    if (news > 0) {
      const created = await client.opsJob.createMany({
        data: [
          {
            idempotencyKey: digestKey,
            type: "telegram_internal_report",
            status: OpsJobStatus.QUEUED,
            stage: OpsJobStage.NOTIFY,
            payload: asJson({
              ...base,
              reportPeriod: "price_watch",
              since: since.toISOString(),
              weekly,
            }),
          },
        ],
        skipDuplicates: true,
      });
      result.digests += created.count;
    }
  }
  const dueSources = await client.opsPriceWatchSource.findMany({
    where: { nextReminderAt: { lte: now } },
    select: { id: true, key: true, nextReminderAt: true },
  });
  for (const source of dueSources) {
    if (!findPriceWatchSource(source.key)?.priceList || !source.nextReminderAt) continue;
    const prefix = `price:remind:${source.key}:${member.adminUserId}:${source.nextReminderAt
      .toISOString()
      .slice(0, 10)}:`;
    const sent = await client.opsJob.findMany({
      where: { idempotencyKey: { startsWith: prefix } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    // The due day, once more a week later, then quiet until someone answers.
    if (sent.length >= REMINDER_ROUNDS) continue;
    if (sent[0] && now.getTime() - sent[0].createdAt.getTime() < 7 * DAY_MS - 3_600_000) continue;
    const created = await client.opsJob.createMany({
      data: [
        {
          idempotencyKey: `${prefix}${sent.length}`,
          type: "telegram_internal_report",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.NOTIFY,
          payload: asJson({
            ...base,
            reportPeriod: "price_list_reminder",
            sourceId: source.id,
            round: sent.length,
          }),
        },
      ],
      skipDuplicates: true,
    });
    result.reminders += created.count;
  }
  return result;
}

export type PriceWatchCallbackAction =
  | "price_digest_task"
  | "price_ack"
  | "price_snooze"
  | "price_list_task"
  | "price_formula";

export type PriceWatchButtonFactory = (
  action: PriceWatchCallbackAction,
  resourceId: string,
  label: string,
  style?: "primary" | "success" | "danger"
) => Promise<OpsTelegramInlineButton | null>;

async function resolveButtons(
  specs: PriceWatchButtonSpec[][],
  resourceId: string,
  button: PriceWatchButtonFactory
): Promise<OpsTelegramReplyMarkup | undefined> {
  const rows: OpsTelegramInlineButton[][] = [];
  for (const row of specs) {
    const resolved: OpsTelegramInlineButton[] = [];
    for (const spec of row) {
      if ("url" in spec) resolved.push({ text: spec.text, url: spec.url });
      else {
        const made = await button(spec.action, resourceId, spec.text, spec.style);
        if (made) resolved.push(made);
      }
    }
    if (resolved.length) rows.push(resolved);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export function priceWatchPageUrl() {
  const url = opsAdminLink("/admin/operations/prices");
  return /^https?:\/\//.test(url) ? url : null;
}

async function loadDigestEntries(client: PrismaClient, since: Date, weekly: boolean) {
  return entriesFromRuns(await latestPriceWatchRuns(client, weekly ? undefined : since));
}

/** Builds the digest or a reminder at send time from the current state; null = nothing to send. */
export async function buildPriceWatchNotification(input: {
  client: PrismaClient;
  jobId: string;
  payload: Record<string, unknown>;
  now: Date;
  timeZone: string;
  button: PriceWatchButtonFactory;
  /** Owners get «✏️ … по формуле» under the digest. */
  canChangePrices?: boolean;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup; parseMode: "HTML" } | null> {
  const { client, payload, now } = input;
  const pricesUrl = priceWatchPageUrl();
  if (payload.reportPeriod === "price_watch") {
    const since = new Date(String(payload.since ?? ""));
    const weekly = payload.weekly === true;
    const entries = await loadDigestEntries(
      client,
      Number.isNaN(since.getTime()) ? new Date(now.getTime() - DAY_MS) : since,
      weekly
    );
    let priceLists: PriceWatchPriceListLine[] = [];
    let planned: { titles: string[]; products: number } | undefined;
    let factLines: ReturnType<typeof priceWatchWeeklyFactLines> | undefined;
    if (weekly) {
      const [rows, productsByBrand, facts] = await Promise.all([
        client.opsPriceWatchSource.findMany({ select: { key: true, nextReminderAt: true } }),
        publishedProductsByBrand(client),
        loadPriceWatchFacts(client, now),
      ]);
      priceLists = priceWatchPriceListLines(rows, now);
      planned = priceWatchPlannedLine(productsByBrand);
      factLines = priceWatchWeeklyFactLines(facts);
    }
    const text = renderPriceWatchDigest({
      now,
      timeZone: input.timeZone,
      entries,
      weekly,
      priceLists,
      planned,
      newItems: factLines?.newItems,
      stock: factLines?.stock,
    });
    if (!text) return null;
    const markup = await resolveButtons(
      priceWatchDigestButtons(pricesUrl),
      input.jobId,
      input.button
    );
    const fixes: OpsTelegramInlineButton[][] = [];
    if (input.canChangePrices) {
      const rows = await client.opsPriceWatchSource.findMany({ select: { id: true, key: true } });
      for (const entry of entries) {
        const count = entry.findings.filter(
          (finding) =>
            (finding.kind === "cheaper" || finding.kind === "dearer") &&
            (weekly || finding.isNew !== false)
        ).length;
        const row = rows.find((candidate) => candidate.key === entry.key);
        // A systemic difference gets a warning in the text, never a one-click fix.
        if (!count || !row || fixes.length >= 3) continue;
        if (systemicPriceWatchDifference(entry.summary, entry.checked)) continue;
        const button = await input.button(
          "price_formula",
          row.id,
          `✏️ ${entry.title}: по формуле (${count})`,
          "primary"
        );
        if (button) fixes.push([button]);
      }
    }
    const keyboard = [...fixes, ...(markup?.inline_keyboard ?? [])];
    return {
      text,
      parseMode: "HTML",
      ...(keyboard.length ? { replyMarkup: { inline_keyboard: keyboard } } : {}),
    };
  }
  if (payload.reportPeriod === "price_list_reminder") {
    const source = await client.opsPriceWatchSource.findUnique({
      where: { id: String(payload.sourceId ?? "") },
    });
    const def = source ? findPriceWatchSource(source.key) : null;
    // Somebody already answered: the reminder moved forward.
    if (!source || !def?.priceList || !source.nextReminderAt || source.nextReminderAt > now) {
      return null;
    }
    const [products, lastRun] = await Promise.all([
      client.shopProduct.count({
        where: {
          status: ShopCatalogStatus.ACTIVE,
          isPublished: true,
          brand: { in: [...def.brands] },
        },
      }),
      def.check
        ? client.opsPriceWatchRun.findFirst({
            where: {
              sourceId: source.id,
              finishedAt: { gt: new Date(now.getTime() - 14 * DAY_MS) },
            },
            orderBy: { finishedAt: "desc" },
            select: { summary: true },
          })
        : null,
    ]);
    const counts = summaryOf(lastRun?.summary).counts ?? {};
    const changed = (counts.up ?? 0) + (counts.down ?? 0);
    const text = renderPriceListReminder({
      title: def.title,
      label: def.priceList.label,
      priceListDate: source.priceListDate ?? initialPriceListDates(def).priceListDate!,
      now,
      products,
      formula: def.formula,
      secondTime: Number(payload.round) > 0,
      signal:
        changed && def.url ? { changed, site: new URL(def.url).host.replace(/^www\./, "") } : null,
    });
    return {
      text,
      parseMode: "HTML",
      replyMarkup: await resolveButtons(
        priceListReminderButtons(pricesUrl),
        source.id,
        input.button
      ),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Telegram buttons
// ---------------------------------------------------------------------------

export type PriceWatchActor = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
};

function dayMonth(date: Date, timeZone = "Europe/Kyiv") {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "numeric", month: "long" }).format(date);
}

function audit(
  actor: PriceWatchActor,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>
) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name,
    scope: "operations",
    action,
    entityType: "ops.price_source",
    entityId,
    metadata: asJson(metadata),
  };
}

async function loadPriceSource(client: PrismaClient, sourceId: string) {
  const source = await client.opsPriceWatchSource.findUnique({ where: { id: sourceId } });
  const def = source ? findPriceWatchSource(source.key) : null;
  if (!source || !def?.priceList) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  return { source, def, priceList: def.priceList };
}

/** «Прайс актуален»: the next reminder comes after the usual interval. */
export async function acknowledgePriceList(input: {
  client: PrismaClient;
  actor: PriceWatchActor;
  sourceId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { source, def, priceList } = await loadPriceSource(input.client, input.sourceId);
  const nextReminderAt = new Date(now.getTime() + priceList.everyDays * DAY_MS);
  await input.client.$transaction([
    input.client.opsPriceWatchSource.update({ where: { id: source.id }, data: { nextReminderAt } }),
    input.client.adminAuditLog.create({
      data: audit(input.actor, "telegram.price_list.confirm", source.id, {
        source: def.key,
        nextReminderAt: nextReminderAt.toISOString(),
      }),
    }),
  ]);
  return {
    message: `Ок, прайс ${def.title} считаем актуальным. Напомню ${dayMonth(nextReminderAt)}.`,
    link: priceWatchPageUrl(),
  };
}

/** «Через неделю». */
export async function snoozePriceList(input: {
  client: PrismaClient;
  actor: PriceWatchActor;
  sourceId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { source, def } = await loadPriceSource(input.client, input.sourceId);
  const nextReminderAt = new Date(now.getTime() + 7 * DAY_MS);
  await input.client.$transaction([
    input.client.opsPriceWatchSource.update({ where: { id: source.id }, data: { nextReminderAt } }),
    input.client.adminAuditLog.create({
      data: audit(input.actor, "telegram.price_list.snooze", source.id, {
        source: def.key,
        nextReminderAt: nextReminderAt.toISOString(),
      }),
    }),
  ]);
  return {
    message: `Напомню о прайсе ${def.title} через неделю — ${dayMonth(nextReminderAt)}.`,
    link: null,
  };
}

async function createPriceTask(input: {
  client: PrismaClient;
  actor: PriceWatchActor;
  sourceKey: string;
  sourceId: string;
  title: string;
  description: string;
  nextAction: string;
  tags: string[];
  afterCreate?: (tx: Prisma.TransactionClient) => Promise<unknown>;
}) {
  if (!matchesAdminPermission(input.actor.permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE)) {
    throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  }
  const clock = opsLocalClock(new Date());
  const dueAt = opsLocalTime(addOpsLocalDays(clock.date, 3), 18);
  try {
    const task = await input.client.$transaction(async (tx) => {
      const created = await tx.opsTask.create({
        data: {
          externalId: createOpsExternalId("ONE"),
          title: input.title.slice(0, 200),
          description: input.description.slice(0, 8_000),
          tags: input.tags,
          status: OpsTaskStatus.PLANNED,
          priority: OpsPriority.NORMAL,
          dueAt,
          nextAction: input.nextAction,
          sourceType: OpsTaskSourceType.TELEGRAM,
          sourceId: input.sourceId,
          sourceKey: input.sourceKey,
          createdById: input.actor.id,
          assigneeId: input.actor.id,
          assignees: { create: [{ adminUserId: input.actor.id, assignedById: input.actor.id }] },
        },
        select: { id: true, number: true },
      });
      await tx.opsTaskEvent.create({
        data: {
          taskId: created.id,
          type: OpsTaskEventType.CREATED,
          actorId: input.actor.id,
          sourceType: OpsTaskSourceType.TELEGRAM,
          sourceId: input.sourceId,
          idempotencyKey: input.sourceKey,
          payload: { priceWatch: true },
        },
      });
      await input.afterCreate?.(tx);
      return created;
    });
    return {
      message: `Создал задачу #${task.number} «${input.title}» — на вас, срок ${dayMonth(dueAt)}.`,
      link: opsAdminLink(`/admin/operations/tasks/${task.id}`),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await input.client.opsTask.findUnique({
        where: { sourceKey: input.sourceKey },
        select: { id: true, number: true },
      });
      if (existing) {
        return {
          message: `Задача уже есть: #${existing.number}.`,
          link: opsAdminLink(`/admin/operations/tasks/${existing.id}`),
        };
      }
    }
    throw error;
  }
}

/** «Создать задачу» under a price-list reminder; the reminder pauses for two weeks. */
export async function createPriceListTask(input: {
  client: PrismaClient;
  actor: PriceWatchActor;
  sourceId: string;
}) {
  const { source, def, priceList } = await loadPriceSource(input.client, input.sourceId);
  const now = new Date();
  return createPriceTask({
    client: input.client,
    actor: input.actor,
    sourceKey: `price-list:${def.key}:${opsLocalClock(now).date}`,
    sourceId: source.id,
    title: `Обновить прайс ${def.title}`,
    description: [
      `Цены ${def.title} на сайте посчитаны по: ${priceList.label}.`,
      `Формула: ${def.formula}.`,
      "Запросить у поставщика актуальный прайс, прислать файл в бот или приложить к задаче — пересчитаем цены.",
    ].join("\n"),
    nextAction: "Запросить у поставщика актуальный прайс",
    tags: ["price-watch", `price-source:${def.key}`],
    afterCreate: (tx) =>
      tx.opsPriceWatchSource.update({
        where: { id: source.id },
        data: { nextReminderAt: new Date(now.getTime() + TASK_SNOOZE_DAYS * DAY_MS) },
      }),
  });
}

/** «Создать задачу» under a digest: one task with everything new in it. */
export async function createPriceWatchDigestTask(input: {
  client: PrismaClient;
  actor: PriceWatchActor;
  jobId: string;
}) {
  const job = await input.client.opsJob.findUnique({
    where: { id: input.jobId },
    select: { id: true, payload: true, createdAt: true },
  });
  const payload = (job?.payload && typeof job.payload === "object" ? job.payload : {}) as Record<
    string,
    unknown
  >;
  if (!job || payload.reportPeriod !== "price_watch")
    throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const since = new Date(String(payload.since ?? ""));
  const entries = (
    await loadDigestEntries(
      input.client,
      Number.isNaN(since.getTime()) ? new Date(job.createdAt.getTime() - DAY_MS) : since,
      payload.weekly === true
    )
  ).filter(isPriceWatchEntryReportable);
  const description = renderPriceWatchTaskDescription(entries);
  if (!description) {
    return { message: "Новых отличий в ценах нет — задача не нужна.", link: priceWatchPageUrl() };
  }
  const brands = entries.map((entry) => entry.title);
  return createPriceTask({
    client: input.client,
    actor: input.actor,
    sourceKey: `price-digest:${job.id}`,
    sourceId: job.id,
    title: `Проверить цены: ${brands.slice(0, 3).join(", ")}${brands.length > 3 ? " и др." : ""}`,
    description: `${description}\n\nПодробности: «Работа → Цены».`,
    nextAction: "Сверить цены с поставщиком и решить, что обновить",
    tags: ["price-watch"],
  });
}

// ---------------------------------------------------------------------------
// «Работа → Цены»
// ---------------------------------------------------------------------------

export type PriceWatchOverviewStatus =
  | PriceWatchStatus
  | "running"
  | "waiting"
  | "planned"
  | "price_list";

export type PriceWatchOverviewSource = {
  key: string;
  title: string;
  kind: PriceWatchKind;
  site: string;
  url: string | null;
  formula: string;
  note: string | null;
  products: number;
  everyHours: number | null;
  status: PriceWatchOverviewStatus;
  lastFinishedAt: string | null;
  nextCheckAt: string | null;
  progress: { checked: number } | null;
  priceList: {
    label: string;
    date: string;
    nextReminderAt: string | null;
    overdue: boolean;
  } | null;
  run: {
    status: PriceWatchStatus;
    checked: number;
    findingsCount: number;
    newFindings: number;
    finishedAt: string;
    summary: PriceWatchSummary;
    findings: PriceWatchFinding[];
  } | null;
  /** What the supplier shows about our products: stock, weight, size; items we do not sell. */
  facts: Omit<PriceWatchFactsSummary, "sourceKey"> | null;
};

export type PriceWatchOverview = {
  generatedAt: string;
  demo: boolean;
  sources: PriceWatchOverviewSource[];
  fx: PriceWatchSummary["fx"] | null;
  totals: {
    sources: number;
    automated: number;
    products: number;
    productsWatched: number;
    findings: number;
    priceListsDue: number;
    errors: number;
    outOfStock: number;
    withWeight: number;
    withSize: number;
    newItems: number;
  };
  newItems: PriceWatchNewItem[];
  /** Price changes made from Telegram in the last 30 days. */
  changes: PriceWatchRecentChange[];
  preview: {
    daily: string | null;
    weekly: string;
    reminders: Array<{ key: string; text: string }>;
    /** Sample answers to commands and files, built by the local dry run only. */
    examples?: Array<{ key: string; label: string; html: string; buttons: string[][] }>;
  };
};

export type PriceWatchOverviewRow = Pick<
  OpsPriceWatchSource,
  "key" | "state" | "lastFinishedAt" | "lastStatus" | "priceListDate" | "nextReminderAt"
>;
type OverviewRow = PriceWatchOverviewRow;

/** Everything the «Цены» page shows, from source rows, their latest runs and product counts. */
export function buildPriceWatchOverview(input: {
  now: Date;
  timeZone?: string;
  rows: OverviewRow[];
  runs: RunRow[];
  productsByBrand: ReadonlyMap<string, number>;
  facts?: { summaries: PriceWatchFactsSummary[]; newItems: PriceWatchNewItem[] };
  changes?: PriceWatchRecentChange[];
  demo?: boolean;
}): PriceWatchOverview {
  const timeZone = input.timeZone ?? "Europe/Kyiv";
  const factSummaries = input.facts?.summaries ?? [];
  const newItems = input.facts?.newItems ?? [];
  const sources = PRICE_WATCH_SOURCES.filter((def) => def.kind !== "fx").map((def) => {
    const row = input.rows.find((entry) => entry.key === def.key) ?? null;
    const run = input.runs.find((entry) => entry.sourceKey === def.key) ?? null;
    const factSummary = factSummaries.find((entry) => entry.sourceKey === def.key) ?? null;
    const dates = initialPriceListDates(def);
    const nextReminderAt = row?.nextReminderAt ?? dates.nextReminderAt;
    const priceListDate = row?.priceListDate ?? dates.priceListDate;
    const overdue = Boolean(nextReminderAt && nextReminderAt.getTime() <= input.now.getTime());
    const progress = parsePriceWatchProgress(row?.state);
    const status: PriceWatchOverviewStatus =
      def.kind === "planned"
        ? "planned"
        : progress
          ? "running"
          : run
            ? (run.status as PriceWatchStatus)
            : def.check
              ? "waiting"
              : "price_list";
    return {
      key: def.key,
      title: def.title,
      kind: def.kind,
      site: def.site,
      url: def.url ?? null,
      formula: def.formula,
      note: def.note ?? null,
      products: priceWatchProductCount(def, input.productsByBrand),
      everyHours: def.everyHours ?? null,
      status,
      lastFinishedAt: row?.lastFinishedAt?.toISOString() ?? run?.finishedAt.toISOString() ?? null,
      nextCheckAt: row ? (nextPriceWatchCheckAt(def, row)?.toISOString() ?? null) : null,
      progress: progress ? { checked: progress.checked } : null,
      priceList: def.priceList
        ? {
            label: def.priceList.label,
            date: (priceListDate ?? new Date(def.priceList.date)).toISOString(),
            nextReminderAt: nextReminderAt?.toISOString() ?? null,
            overdue,
          }
        : null,
      run: run
        ? {
            status: run.status as PriceWatchStatus,
            checked: run.checked,
            findingsCount: run.findingsCount,
            newFindings: run.newFindings,
            finishedAt: run.finishedAt.toISOString(),
            summary: summaryOf(run.summary),
            findings: findingsOf(run.findings).slice(0, 80),
          }
        : null,
      facts: factSummary
        ? {
            matched: factSummary.matched,
            withWeight: factSummary.withWeight,
            withSize: factSummary.withSize,
            withStock: factSummary.withStock,
            outOfStock: factSummary.outOfStock,
            supplierOnly: factSummary.supplierOnly,
          }
        : null,
    } satisfies PriceWatchOverviewSource;
  });
  const manufacturerFacts = sources.filter(
    (source) => source.kind !== "competitor" && source.facts
  );
  const factLines = priceWatchWeeklyFactLines({ summaries: factSummaries, newItems });
  const fxDef = PRICE_WATCH_SOURCES.find((def) => def.kind === "fx");
  const fxRun = input.runs.find((entry) => entry.sourceKey === fxDef?.key);
  const entries = entriesFromRuns(input.runs);
  const priceLists = priceWatchPriceListLines(input.rows, input.now);
  const planned = priceWatchPlannedLine(input.productsByBrand);
  const watched = sources.filter((source) => source.kind !== "planned");
  const reminders = sources
    .filter((source) => source.priceList?.overdue)
    .map((source) => {
      const def = findPriceWatchSource(source.key)!;
      const counts = source.run?.summary.counts ?? {};
      const changed = (counts.up ?? 0) + (counts.down ?? 0);
      return {
        key: source.key,
        text: renderPriceListReminder({
          title: def.title,
          label: def.priceList!.label,
          priceListDate: new Date(source.priceList!.date),
          now: input.now,
          products: source.products,
          formula: def.formula,
          secondTime: false,
          signal:
            changed && def.url
              ? { changed, site: new URL(def.url).host.replace(/^www\./, "") }
              : null,
        }),
      };
    });
  return {
    generatedAt: input.now.toISOString(),
    demo: Boolean(input.demo),
    sources,
    fx: fxRun ? (summaryOf(fxRun.summary).fx ?? null) : null,
    totals: {
      sources: sources.length,
      automated: sources.filter(
        (source) =>
          source.kind === "formula" || source.kind === "changes" || source.kind === "atomic"
      ).length,
      products: sources.reduce((sum, source) => sum + source.products, 0),
      productsWatched: watched.reduce((sum, source) => sum + source.products, 0),
      findings: sources.reduce(
        (sum, source) =>
          sum + (source.run && source.run.status !== "baseline" ? source.run.findingsCount : 0),
        0
      ),
      priceListsDue: sources.filter((source) => source.priceList?.overdue).length,
      errors: sources.filter((source) => source.status === "error").length,
      outOfStock: manufacturerFacts.reduce(
        (sum, source) => sum + (source.facts?.outOfStock ?? 0),
        0
      ),
      withWeight: manufacturerFacts.reduce(
        (sum, source) => sum + (source.facts?.withWeight ?? 0),
        0
      ),
      withSize: manufacturerFacts.reduce((sum, source) => sum + (source.facts?.withSize ?? 0), 0),
      newItems: newItems.length,
    },
    newItems: newItems.slice(0, 120),
    changes: input.changes ?? [],
    preview: {
      daily: renderPriceWatchDigest({ now: input.now, timeZone, entries, weekly: false }),
      weekly:
        renderPriceWatchDigest({
          now: input.now,
          timeZone,
          entries,
          weekly: true,
          priceLists,
          planned,
          newItems: factLines.newItems,
          stock: factLines.stock,
        }) ?? "",
      reminders,
    },
  };
}

/** Applied, undone and failed changes from the bot (proposals that were never applied are left out). */
async function loadRecentPriceChanges(
  client: PrismaClient,
  now: Date
): Promise<PriceWatchRecentChange[]> {
  const rows = await client.opsPriceChange.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
      status: { in: ["applying", "applied", "undone", "failed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      title: true,
      origin: true,
      status: true,
      itemCount: true,
      appliedCount: true,
      failedCount: true,
      requestedById: true,
      createdAt: true,
      appliedAt: true,
    },
  });
  const people = rows.length
    ? await client.adminUser.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.requestedById))] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const names = new Map(people.map((person) => [person.id, person.name || person.email]));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    origin: row.origin,
    status: row.status,
    itemCount: row.itemCount,
    appliedCount: row.appliedCount,
    failedCount: row.failedCount,
    requestedBy: names.get(row.requestedById) ?? "—",
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  }));
}

export async function loadPriceWatchOverview(client: PrismaClient, now = new Date()) {
  const [rows, runs, productsByBrand, facts, changes] = await Promise.all([
    client.opsPriceWatchSource.findMany(),
    latestPriceWatchRuns(client),
    publishedProductsByBrand(client),
    loadPriceWatchFacts(client, now),
    loadRecentPriceChanges(client, now),
  ]);
  return buildPriceWatchOverview({ now, rows, runs, productsByBrand, facts, changes });
}

/** The same counts as loadPriceWatchFacts, from facts held in memory (the dry run). */
export function summarizePriceWatchFacts(
  sourceKey: string,
  facts: readonly PriceWatchFact[]
): PriceWatchFactsSummary {
  const ours = facts.filter((fact) => fact.productId);
  return {
    sourceKey,
    matched: ours.length,
    withWeight: ours.filter((fact) => fact.weightKg !== null).length,
    withSize: ours.filter((fact) => fact.lengthCm !== null && fact.lengthCm !== undefined).length,
    withStock: ours.filter((fact) => fact.available !== null).length,
    outOfStock: ours.filter((fact) => fact.available === false).length,
    supplierOnly: facts.length - ours.length,
  };
}

export { publishedProductsByBrand };
