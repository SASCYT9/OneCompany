import { ShopCatalogOutboxStatus, PrismaClient } from "@prisma/client";

import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";

const prisma = new PrismaClient();
const maxBatches = readPositiveInteger("--max-batches");
const batchSize = Math.max(1, Math.min(50, readPositiveInteger("--batch-size") ?? 10));
const workerId = `shop-catalog-media-drain:${process.pid}`;

function readPositiveInteger(name: string) {
  const prefix = `${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function activeOutboxCount() {
  return prisma.shopCatalogOutbox.count({
    where: {
      status: {
        in: [
          ShopCatalogOutboxStatus.PENDING,
          ShopCatalogOutboxStatus.RETRY,
          ShopCatalogOutboxStatus.PROCESSING,
        ],
      },
    },
  });
}

async function main() {
  let batch = 0;
  let claimed = 0;
  let completed = 0;
  let retried = 0;
  let deadLettered = 0;
  let lostLease = 0;

  while (!maxBatches || batch < maxBatches) {
    const result = await runShopCatalogOutboxRuntime({ workerId, limit: batchSize });
    batch += 1;
    claimed += result.claimed;
    completed += result.completed;
    retried += result.retried;
    deadLettered += result.deadLettered;
    lostLease += result.lostLease;
    const active = await activeOutboxCount();
    console.log(
      JSON.stringify({
        batch,
        claimed: result.claimed,
        completed: result.completed,
        retried: result.retried,
        deadLettered: result.deadLettered,
        lostLease: result.lostLease,
        active,
        totals: { claimed, completed, retried, deadLettered, lostLease },
      })
    );

    if (active === 0) break;
    if (result.claimed === 0) await sleep(5_000);
  }

  const final = await prisma.shopCatalogOutbox.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(JSON.stringify({ finished: true, batches: batch, final }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
