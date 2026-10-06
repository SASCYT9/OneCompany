import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  coordinateShopCatalogPriceBatchInTransaction,
  SHOP_PRICE_BATCH_FIELDS,
} from "../src/lib/shopCatalogPriceBatch.server";
import { shopPriceSourceReadiness } from "../src/lib/shopPriceSourceReadiness.server";
import { retrySerializablePriceBatch } from "../src/lib/shopPriceBookBatchRetry";

type RecordChange = {
  id: string;
  sku: string | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};
type Entry = {
  product: RecordChange;
  variants: RecordChange[];
  catalogVersion: string;
  updatedAt: string;
  published: boolean;
};
const arg = (key: string) =>
  process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const mode = process.argv.includes("--apply") ? "APPLY" : "DRY_RUN";
const directory = resolve(arg("dir") ?? "outputs/price-source-completion-2026-10-05/all-active");
const envPath = arg("env-path");
if (!envPath) throw new Error("An explicit env-path is required");
const env = parse(readFileSync(resolve(envPath)));
const connection = env.DIRECT_URL || env.DATABASE_URL;
const target = new URL(connection);
const local =
  ["127.0.0.1", "localhost"].includes(target.hostname) &&
  target.pathname.startsWith("/monobank_test");
const identityHash = createHash("sha256")
  .update(target.hostname + target.pathname)
  .digest("hex");
const planBytes = readFileSync(resolve(directory, "price-book-plan.json"));
const planHash = createHash("sha256").update(planBytes).digest("hex");
const expectedHash = readFileSync(resolve(directory, "price-book-plan.sha256"), "utf8").trim();
if (planHash !== expectedHash) throw new Error("Plan checksum mismatch");
if (
  mode === "APPLY" &&
  !local &&
  (arg("database-hash") !== identityHash || arg("plan-hash") !== planHash)
)
  throw new Error("Explicit production identity and exact plan hashes required");
const plan = JSON.parse(planBytes.toString()) as {
  exceptions: unknown[];
  changes: Entry[];
  nbu: { exchangedAt: string };
};
if (plan.exceptions.length) throw new Error("Unresolved source prices: no apply");
const batchSize = Number(arg("batch-size") ?? 10);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10)
  throw new Error("Batch size must be 1..10");
const maxBatches = arg("max-batches") ? Number(arg("max-batches")) : null;
if (maxBatches != null && (!Number.isSafeInteger(maxBatches) || maxBatches < 1))
  throw new Error("max-batches must be a positive integer");
const checkpointPath = resolve(
  directory,
  local ? "local-apply-receipt.json" : "production-apply-receipt.json"
);
const receipt = {
  mode,
  local,
  identityHash,
  planHash,
  startedAt: new Date().toISOString(),
  applied: [] as Array<{ id: string; version: string; outboxId: string }>,
  completedAt: null as string | null,
};
if (process.argv.includes("--resume")) {
  const previous = JSON.parse(readFileSync(checkpointPath, "utf8"));
  if (previous.identityHash !== identityHash || previous.planHash !== planHash)
    throw new Error("Resume receipt differs from target or plan");
  receipt.applied = previous.applied;
}
const allowed = new Set([
  "priceSourceCurrency",
  "compareAtSourceCurrency",
  "b2bPriceSourceCurrency",
  "b2bCompareAtSourceCurrency",
  "priceEur",
  "priceUsd",
  "priceUah",
  "compareAtEur",
  "compareAtUsd",
  "compareAtUah",
  "priceEurB2b",
  "priceUsdB2b",
  "priceUahB2b",
  "compareAtEurB2b",
  "compareAtUsdB2b",
  "compareAtUahB2b",
]);
for (const entry of plan.changes)
  for (const row of [entry.product, ...entry.variants])
    for (const key of Object.keys(row.after))
      if (!allowed.has(key)) throw new Error("Unexpected write field");
const db = new PrismaClient({ datasources: { db: { url: connection } } });
function assertBefore(current: Record<string, unknown>, change: RecordChange) {
  if (current.sku !== change.sku) throw new Error(`SKU changed: ${change.id}`);
  for (const [key, value] of Object.entries(change.before)) {
    const actual = current[key];
    if (
      key.endsWith("Currency")
        ? (actual ?? null) !== (value ?? null)
        : value == null
          ? actual != null
          : Number(actual) !== Number(value)
    )
      throw new Error(`Price input changed: ${change.id}/${key}`);
  }
}
function check(
  current: {
    id: string;
    sku: string | null;
    catalogVersion: bigint;
    variants: Array<{ id: string; sku: string | null }>;
  },
  entry: Entry
) {
  if (String(current.catalogVersion) !== entry.catalogVersion)
    throw new Error(`Catalog version changed: ${current.id}`);
  assertBefore(current as unknown as Record<string, unknown>, entry.product);
  if (current.variants.length !== entry.variants.length)
    throw new Error(`Variants changed: ${current.id}`);
  for (const row of entry.variants) {
    const actual = current.variants.find((v) => v.id === row.id);
    if (!actual) throw new Error(`Variant missing: ${row.id}`);
    assertBefore(actual as unknown as Record<string, unknown>, row);
  }
}
/** A committed batch can outlive a crash before its checkpoint rename. */
function matchesAfter(current: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.entries(after).every(([key, value]) => {
    const actual = current[key];
    if (key.endsWith("Currency")) return (actual ?? null) === (value ?? null);
    return value == null ? actual == null : Number(actual) === Number(value);
  });
}
function alreadyApplied(
  current: { variants: Array<{ id: string }> } & Record<string, unknown>,
  entry: Entry
) {
  if (!matchesAfter(current, entry.product.after)) return false;
  return entry.variants.every((row) => {
    const actual = current.variants.find((v) => v.id === row.id);
    return Boolean(actual) && matchesAfter(actual as unknown as Record<string, unknown>, row.after);
  });
}
async function main() {
  const done = new Set(receipt.applied.map((row) => row.id));
  const resuming = process.argv.includes("--resume");
  // Check the entire remainder before the first write; a batch rechecks under locks.
  for (let offset = 0; offset < plan.changes.length; offset += 500) {
    const entries = plan.changes
      .slice(offset, offset + 500)
      .filter((row) => !done.has(row.product.id));
    const rows = await db.shopProduct.findMany({
      where: { id: { in: entries.map((e) => e.product.id) } },
      select: {
        id: true,
        sku: true,
        catalogVersion: true,
        ...Object.fromEntries(SHOP_PRICE_BATCH_FIELDS.map((field) => [field, true])),
        variants: {
          select: {
            id: true,
            sku: true,
            ...Object.fromEntries(SHOP_PRICE_BATCH_FIELDS.map((field) => [field, true])),
          },
        },
      },
    });
    for (const entry of entries) {
      const current = rows.find((r) => r.id === entry.product.id);
      if (!current) throw new Error(`Product missing: ${entry.product.id}`);
      // On resume, a product already at its planned prices was committed by a batch
      // whose checkpoint was lost; record it instead of rejecting the advanced version.
      if (resuming && alreadyApplied(current as never, entry)) {
        done.add(entry.product.id);
        receipt.applied.push({
          id: entry.product.id,
          version: String(current.catalogVersion),
          outboxId: "reconciled-on-resume",
        });
        continue;
      }
      check(current, entry);
    }
  }
  console.log(
    JSON.stringify({
      mode,
      local,
      identityHash,
      planHash,
      products: plan.changes.length,
      alreadyApplied: done.size,
      freshBeforeCheck: "passed",
    })
  );
  if (mode === "DRY_RUN") return;
  writeFileSync(checkpointPath + ".next", JSON.stringify(receipt, null, 2));
  renameSync(checkpointPath + ".next", checkpointPath);
  const remaining = plan.changes.filter((row) => !done.has(row.product.id));
  for (let offset = 0; offset < remaining.length; offset += batchSize) {
    if (maxBatches != null && offset / batchSize >= maxBatches) {
      console.log(
        JSON.stringify({
          boundedRunComplete: true,
          applied: receipt.applied.length,
          total: plan.changes.length,
        })
      );
      return;
    }
    const batch = remaining.slice(offset, offset + batchSize);
    const batchStartedAt = Date.now();
    const results = await retrySerializablePriceBatch(
      () =>
        db.$transaction(
          (tx) =>
            coordinateShopCatalogPriceBatchInTransaction(tx, batch, {
              type: "system",
              id: "price-book-source-initialization",
              reason:
                "Owner-confirmed source currencies; +1 UAH to USD and EUR; sale cross derived from both buffered rates",
            }),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 120000,
            maxWait: 10000,
          }
        ),
      (attempt) =>
        console.log(JSON.stringify({ retryingPriceBatch: offset, attempt, reason: "P2034" }))
    );
    receipt.applied.push(...results);
    writeFileSync(checkpointPath + ".next", JSON.stringify(receipt, null, 2));
    renameSync(checkpointPath + ".next", checkpointPath);
    if (maxBatches != null)
      console.log(
        JSON.stringify({
          batchProducts: batch.length,
          batchDurationMs: Date.now() - batchStartedAt,
        })
      );
    if (receipt.applied.length % 100 === 0 || receipt.applied.length === plan.changes.length)
      console.log(JSON.stringify({ applied: receipt.applied.length, total: plan.changes.length }));
  }
  const readiness = await shopPriceSourceReadiness(db);
  if (!readiness.ready)
    throw new Error(`Source coverage incomplete after apply: ${readiness.unresolvedBands}`);
  receipt.completedAt = new Date().toISOString();
  writeFileSync(checkpointPath, JSON.stringify({ ...receipt, readiness }, null, 2));
  console.log(
    JSON.stringify({ applied: receipt.applied.length, readiness, priceBookActivated: false })
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
