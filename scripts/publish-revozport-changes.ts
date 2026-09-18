import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { processShopCatalogOutboxJob, type ShopCatalogClaimedOutbox } from "../src/lib/shopCatalogOutboxWorker.server";
import { projectionSourceFromRevision } from "../src/lib/shopCatalogProjectionSource.server";
import { buildShopCatalogProjection } from "../src/lib/shopCatalogProjection.server";
import { persistShopCatalogProjectionBuild } from "../src/lib/shopCatalogProjectionPersistence.server";

async function main() {
  if (!process.argv.includes("--commit") || !process.argv.includes("--target=onecompany.global")) throw new Error("Explicit commit and target required");
  const workerId = `revozport-publication:${randomUUID()}`;
  try {
    const candidates = await prisma.shopCatalogOutbox.findMany({
      where: { entityType: "PRODUCT", product: { brand: "Revozport" },
        OR: [{ status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: new Date() } }, { status: "PROCESSING", leaseExpiresAt: { lt: new Date() } }],
        revision: { actorId: "revozport-content@system.local" } },
      select: { id: true, productId: true }, orderBy: [{ createdAt: "asc" }], take: 600,
    });
    let completed = 0;
    let projectionQueue = Promise.resolve();
    const failed: unknown[] = [];
    const byProduct = new Map<string | null, typeof candidates>();
    for (const job of candidates) byProduct.set(job.productId, [...(byProduct.get(job.productId) ?? []), job]);
    const groups = [...byProduct.values()];
    let cursor = 0;
    async function worker() {
      while (cursor < groups.length) {
      const group = groups[cursor++];
      // One worker per product preserves revision order and receipt ownership.
      for (const candidate of group) {
      const now = new Date();
      const claimed = await prisma.shopCatalogOutbox.updateMany({
        where: { id: candidate.id, OR: [{ status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: now } }, { status: "PROCESSING", leaseExpiresAt: { lt: now } }] },
        data: { status: "PROCESSING", attempts: { increment: 1 }, lockedBy: workerId, lockedAt: now, leaseExpiresAt: new Date(now.getTime() + 120_000) },
      });
      if (claimed.count !== 1) continue;
      const job = await prisma.shopCatalogOutbox.findUniqueOrThrow({ where: { id: candidate.id }, include: { revision: true } }) as ShopCatalogClaimedOutbox;
      let persistence: Promise<void> | null = null;
      const publish = async () => {
        persistence ??= (async () => {
          const current = await prisma.shopProduct.findUniqueOrThrow({ where: { id: job.productId! }, select: { catalogVersion: true, brand: true } });
          if (current.brand !== "Revozport") throw new Error("Unexpected brand");
          if (current.catalogVersion > job.canonicalVersion) return;
          const source = projectionSourceFromRevision({ productId: job.productId!, catalogVersion: job.canonicalVersion,
            revisionId: job.revision?.id ?? null, revisionVersion: job.revision?.version ?? null,
            contentHash: job.revision?.contentHash ?? null, createdAt: job.revision?.createdAt ?? null, snapshot: job.revision?.snapshot ?? null });
          const build = buildShopCatalogProjection(source);
          const save = async () => {
            for (let attempt = 0; ; attempt++) {
              try { await persistShopCatalogProjectionBuild(build); return; }
              catch (error) {
                if (attempt >= 2 || (error as { code?: string }).code !== "P2034") throw error;
              }
            }
          };
          // Products of the same brand update shared facet counters. Serialize
          // only this stage while independent receipt processing stays concurrent.
          projectionQueue = projectionQueue.then(save, save);
          await projectionQueue;
        })();
        await persistence;
      };
      const result = await processShopCatalogOutboxJob({ job, workerId, handlers: { CONTENT: publish, SEARCH: publish, PRICE: publish, INVENTORY: publish, SETTINGS: publish } });
      if (result.status !== "COMPLETED") { failed.push(result); continue; }
      completed++;
      if (completed % 50 === 0) console.log(`Published ${completed}/${candidates.length}`);
      }
      }
    }
    const workers = await Promise.allSettled([worker(), worker(), worker(), worker()]);
    const failures = workers.filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((r) => r.reason), "Publication incomplete");
    if (failed.length) throw new Error(JSON.stringify({ failed }));
    console.log(JSON.stringify({ completed, candidates: candidates.length }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
