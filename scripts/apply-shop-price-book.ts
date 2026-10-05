import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { coordinateShopCatalogProductMutationInTransaction } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { shopPriceSourceReadiness } from "../src/lib/shopPriceSourceReadiness.server";

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
if (mode === "APPLY" && process.argv.includes("--resume")) {
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
async function main() {
  const done = new Set(receipt.applied.map((row) => row.id));
  // Check the entire remainder before the first write; a batch rechecks under locks.
  for (let offset = 0; offset < plan.changes.length; offset += 500) {
    const entries = plan.changes
      .slice(offset, offset + 500)
      .filter((row) => !done.has(row.product.id));
    const rows = await db.shopProduct.findMany({
      where: { id: { in: entries.map((e) => e.product.id) } },
      include: { variants: true },
    });
    for (const entry of entries) {
      const current = rows.find((r) => r.id === entry.product.id);
      if (!current) throw new Error(`Product missing: ${entry.product.id}`);
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
  const remaining = plan.changes.filter((row) => !done.has(row.product.id));
  for (let offset = 0; offset < remaining.length; offset += batchSize) {
    const batch = remaining.slice(offset, offset + batchSize);
    const results = await db.$transaction(
      async (tx) => {
        const completed = [];
        for (const entry of batch) {
          await tx.$queryRaw`SELECT id FROM "ShopProduct" WHERE id=${entry.product.id} FOR UPDATE`;
          const current = await tx.shopProduct.findUniqueOrThrow({
            where: { id: entry.product.id },
            include: { variants: true },
          });
          check(current, entry);
          const publication = await coordinateShopCatalogProductMutationInTransaction(tx, {
            productId: entry.product.id,
            expectedCatalogVersion: entry.catalogVersion,
            changeDomains: ["PRICE"],
            mutateAndSnapshot: async (client, nextVersion) => {
              await client.shopProduct.update({
                where: { id: entry.product.id },
                data: entry.product.after as Prisma.ShopProductUncheckedUpdateInput,
              });
              for (const variant of entry.variants)
                if (Object.keys(variant.after).length)
                  await client.shopProductVariant.update({
                    where: { id: variant.id },
                    data: variant.after as Prisma.ShopProductVariantUncheckedUpdateInput,
                  });
              return buildShopCatalogAdminSnapshot(client, entry.product.id, nextVersion, {
                type: "system",
                id: "price-book-source-initialization",
                reason:
                  "Owner-confirmed source currencies; NBU raw EUR/USD cross; +1 UAH per source foreign unit",
              });
            },
          });
          completed.push({
            id: entry.product.id,
            version: publication.canonicalVersion,
            outboxId: publication.outboxId,
          });
        }
        return completed;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120000,
        maxWait: 10000,
      }
    );
    receipt.applied.push(...results);
    writeFileSync(checkpointPath, JSON.stringify(receipt, null, 2));
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
