import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { retrySerializablePriceBatch } from "../../../src/lib/shopPriceBookBatchRetry";

const url = process.env.MONOBANK_TEST_DATABASE_URL;
test("concurrent price writes recover from real Serializable conflicts without double applying", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  const db = new PrismaClient({ datasources: { db: { url } } });
  const ids = [randomUUID(), randomUUID()];
  let attempts = 0;
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  try {
    await db.shopProduct.createMany({ data: ids.map((id) => ({ id, slug: id, titleUa: "Synthetic retry", titleEn: "Synthetic retry", isPublished: false, priceEur: 1, priceSourceCurrency: "EUR" })) });
    await Promise.all(ids.map((id) => {
      let initial = true;
      return retrySerializablePriceBatch(() => db.$transaction(async (tx) => {
        attempts++;
        const rows = await tx.shopProduct.findMany({ where: { id: { in: ids } }, select: { id: true, priceEur: true } });
        if (initial) { initial = false; if (++arrived === 2) release(); await barrier; }
        const row = rows.find((row) => row.id === id)!;
        await tx.shopProduct.update({ where: { id }, data: { priceEur: Number(row.priceEur) + 1 } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    }));
    const rows = await db.shopProduct.findMany({ where: { id: { in: ids } } });
    assert.deepEqual(rows.map((row) => Number(row.priceEur)).sort(), [2, 2]);
    assert.ok(attempts >= 3, "one real transaction must have been rolled back and retried");
    let permanentAttempts = 0;
    await assert.rejects(retrySerializablePriceBatch(() => db.$transaction(async (tx) => {
      permanentAttempts++;
      await tx.shopProduct.update({ where: { id: ids[0] }, data: { slug: ids[1] } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })), (error: unknown) => (error as { code?: string }).code === "P2002");
    assert.equal(permanentAttempts, 1, "a permanent data/uniqueness failure must not be replayed");
    assert.equal((await db.shopProduct.findUniqueOrThrow({ where: { id: ids[0] } })).slug, ids[0]);
  } finally {
    await db.shopProduct.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
