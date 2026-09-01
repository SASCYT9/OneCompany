import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";

import { normalizeLegacyApplicationsToShopCatalogV2Policy } from "../src/lib/shopCatalogV2Compatibility";
import { coordinateShopCatalogGlobalMutationWithClient } from "../src/lib/shopCatalogGlobalMutationCoordinator.server";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "../src/lib/shopCatalogOutboxRuntime.server";
import { getShopCatalogPublicationStatusWithClient } from "../src/lib/shopCatalogPublicationStatus.server";
import type { ShopCatalogProjectionSource } from "../src/lib/shopCatalogProjection.server";

const databaseUrl = process.env.CATALOG_PUBLICATION_GATE_DATABASE_URL ?? "";
const sampleCount = 30;

function assertDisposableTarget(value: string) {
  const url = new URL(value);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.searchParams.get("application_name") !== "catalog-publication-gate"
  ) {
    throw new Error("Publication gate requires disposable localhost PostgreSQL");
  }
}

function source(productId: string, version: string): ShopCatalogProjectionSource {
  return {
    productId,
    sourceVersion: version,
    catalogVersion: version,
    canonicalContentHash: "a".repeat(64),
    canonicalRelationCounts: { variants: 0, applications: 0 },
    slug: productId,
    sku: `GATE-${productId}`,
    scopeKey: "auto",
    statusKey: "ACTIVE",
    stockKey: "IN_STOCK",
    isPublished: true,
    stableRank: 1,
    brand: { key: "gate", labelUa: "Gate", labelEn: "Gate" },
    locales: { ua: { title: productId }, en: { title: productId } },
    compatibilityPolicies: [
      normalizeLegacyApplicationsToShopCatalogV2Policy({
        target: { productId },
        requiredDimensions: ["make", "model"],
        verification: "VERIFIED",
        applications: [{ id: `${productId}-fitment`, make: "BMW", model: "M2" }],
      }),
    ],
  };
}

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)]!;
}

async function mutate(client: PrismaClient, productId: string, expectedVersion: string) {
  return coordinateShopCatalogProductMutationWithClient(client, {
    productId,
    expectedCatalogVersion: expectedVersion,
    changeDomains: ["CONTENT", "PRICE", "INVENTORY"],
    async mutateAndSnapshot(tx, nextVersion) {
      await tx.shopProduct.update({
        where: { id: productId },
        data: { titleEn: `${productId}-${nextVersion}` },
      });
      return {
        canonical: { productId, version: nextVersion },
        projectionSource: source(productId, nextVersion),
        actorType: "PUBLICATION_GATE",
        reason: "commit-to-visible latency gate",
      };
    },
  });
}

async function main() {
  const commitSha = process.env.CATALOG_GATE_COMMIT_SHA?.trim().toLowerCase();
  if (!commitSha || !/^[a-f0-9]{40}$/.test(commitSha)) {
    throw new Error("CATALOG_GATE_COMMIT_SHA must be a full 40-character Git commit SHA");
  }
  assertDisposableTarget(databaseUrl);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = `publication-gate-${Date.now()}`;
  try {
    const latencies: number[] = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const productId = `${prefix}-${index}`;
      await client.shopProduct.create({
        data: { id: productId, slug: productId, titleUa: productId, titleEn: productId },
      });
      const started = performance.now();
      const mutation = await mutate(client, productId, "0");
      const publication = await runShopCatalogOutboxRuntime({
        workerId: `${prefix}-worker-${index}`,
        limit: 1,
      });
      if (publication.completed !== 1)
        throw new Error(`Publication did not complete for ${productId}`);
      const status = await getShopCatalogPublicationStatusWithClient(client, {
        productId,
        version: mutation.canonicalVersion,
      });
      if (status?.status !== "PUBLISHED" || status.maxVersionLag !== "0") {
        throw new Error(`Visibility was not verified for ${productId}`);
      }
      latencies.push(performance.now() - started);
    }

    const contentionId = `${prefix}-contention`;
    await client.shopProduct.create({
      data: { id: contentionId, slug: contentionId, titleUa: contentionId, titleEn: contentionId },
    });
    const contention = await Promise.allSettled([
      mutate(client, contentionId, "0"),
      mutate(client, contentionId, "0"),
    ]);
    const contentionWinners = contention.filter((result) => result.status === "fulfilled").length;
    if (contentionWinners !== 1)
      throw new Error(`Expected one contention winner, received ${contentionWinners}`);
    const contentionPublication = await runShopCatalogOutboxRuntime({
      workerId: `${prefix}-contention-worker`,
      limit: 1,
    });
    if (contentionPublication.completed !== 1) {
      throw new Error("Contention winner publication did not complete");
    }

    const global = await coordinateShopCatalogGlobalMutationWithClient(client, {
      publications: [
        {
          entityType: "SETTINGS",
          entityId: "public-shop-settings",
          changeDomains: ["SETTINGS"],
        },
        {
          entityType: "PRICE_BOOK",
          entityId: "public-shop-price-book",
          changeDomains: ["PRICE", "SETTINGS"],
        },
      ],
      mutate: (tx) =>
        tx.shopSettings.upsert({
          where: { key: "shop" },
          create: { key: "shop", appCompanyName: "Publication gate v1" },
          update: { appCompanyName: "Publication gate v1" },
        }),
    });
    if (global.publications.some((entry) => entry.canonicalVersion !== "1")) {
      throw new Error(
        `Global versions did not start at one: ${JSON.stringify(global.publications)}`
      );
    }
    const globalPublication = await runShopCatalogOutboxRuntime({
      workerId: `${prefix}-global-worker`,
      limit: 2,
    });
    if (globalPublication.completed !== 2) {
      throw new Error(`Expected two global publications, received ${globalPublication.completed}`);
    }
    const globalReceipts = await client.shopCatalogPublicationReceipt.findMany({
      where: {
        entityId: { in: ["public-shop-settings", "public-shop-price-book"] },
      },
      select: { entityType: true, entityId: true, target: true, appliedVersion: true },
    });
    if (
      globalReceipts.length !== 3 ||
      globalReceipts.some((receipt) => receipt.appliedVersion !== BigInt(1))
    ) {
      throw new Error(
        `Global receipts did not reach version one: ${JSON.stringify(globalReceipts, (_, value) => (typeof value === "bigint" ? value.toString() : value))}`
      );
    }

    const concurrentGlobal = await Promise.all([
      coordinateShopCatalogGlobalMutationWithClient(client, {
        publications: [
          { entityType: "SETTINGS", entityId: "public-shop-settings", changeDomains: ["SETTINGS"] },
        ],
        mutate: (tx) =>
          tx.shopSettings.update({
            where: { key: "shop" },
            data: { appCompanyName: "Publication gate v2a" },
          }),
      }),
      coordinateShopCatalogGlobalMutationWithClient(client, {
        publications: [
          { entityType: "SETTINGS", entityId: "public-shop-settings", changeDomains: ["SETTINGS"] },
        ],
        mutate: (tx) =>
          tx.shopSettings.update({
            where: { key: "shop" },
            data: { appCompanyName: "Publication gate v2b" },
          }),
      }),
    ]);
    const concurrentGlobalVersions = concurrentGlobal
      .map((entry) => Number(entry.publications[0]!.canonicalVersion))
      .sort((left, right) => left - right);
    if (concurrentGlobalVersions.join(",") !== "2,3") {
      throw new Error(
        `Global contention versions are not monotonic: ${concurrentGlobalVersions.join(",")}`
      );
    }

    const result = {
      version: 1,
      commitSha,
      generatedAt: new Date().toISOString(),
      samples: latencies.length,
      p95Ms: Number(percentile(latencies, 95).toFixed(3)),
      p99Ms: Number(percentile(latencies, 99).toFixed(3)),
      maxMs: Number(Math.max(...latencies).toFixed(3)),
      contentionWinners,
      globalPublications: global.publications.length,
      globalReceipts: globalReceipts.length,
      concurrentGlobalVersions,
      limits: { p95Ms: 2_000, p99Ms: 5_000 },
    };
    if (result.p95Ms >= result.limits.p95Ms || result.p99Ms >= result.limits.p99Ms) {
      throw new Error(`Publication latency SLO failed: ${JSON.stringify(result)}`);
    }
    const directory = path.resolve("artifacts", "catalog-v2-publication");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "catalog-v2-publication-gate.json"),
      `${JSON.stringify(result, null, 2)}\n`
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
