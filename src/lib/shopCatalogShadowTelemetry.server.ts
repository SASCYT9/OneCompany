import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";

type ShadowTelemetryClient = PrismaClient | Prisma.TransactionClient;

function boundedKey(value: string | null | undefined, max: number) {
  return (value?.trim().toLowerCase() ?? "").slice(0, max);
}

function hourBucket(value: Date) {
  const bucket = new Date(value);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

export function resolveShopCatalogDeploymentCommit(env: Record<string, string | undefined>) {
  const commit = (env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA ?? "").trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(commit) ? commit : null;
}

export async function recordShopCatalogShadowObservationWithClient(
  client: ShadowTelemetryClient,
  input: {
    deploymentCommit: string;
    locale: "ua" | "en";
    brand?: string | null;
    category?: string | null;
    mismatch: boolean;
    error: boolean;
    durationMs: number;
    observedAt?: Date;
  }
) {
  if (!/^[a-f0-9]{40}$/i.test(input.deploymentCommit)) {
    throw new TypeError("Shadow telemetry requires a full deployment commit SHA");
  }
  if (input.mismatch && input.error) {
    throw new TypeError("A shadow observation cannot be both mismatch and error");
  }
  const durationMs = Math.max(0, Math.min(2_147_483_647, Math.round(input.durationMs)));
  const bucketStart = hourBucket(input.observedAt ?? new Date());
  const brandKey = boundedKey(input.brand, 200);
  const categoryKey = boundedKey(input.category, 200);
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "ShopCatalogShadowAggregate" (
      "id", "deploymentCommit", "bucketStart", "locale", "brandKey", "categoryKey",
      "sampledRequests", "mismatches", "errors", "durationTotalMs", "durationMaxMs",
      "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${input.deploymentCommit.toLowerCase()}, ${bucketStart}, ${input.locale},
      ${brandKey}, ${categoryKey}, 1, ${input.mismatch ? 1 : 0}, ${input.error ? 1 : 0},
      ${BigInt(durationMs)}, ${durationMs}, NOW(), NOW()
    )
    ON CONFLICT ("deploymentCommit", "bucketStart", "locale", "brandKey", "categoryKey")
    DO UPDATE SET
      "sampledRequests" = "ShopCatalogShadowAggregate"."sampledRequests" + 1,
      "mismatches" = "ShopCatalogShadowAggregate"."mismatches" + EXCLUDED."mismatches",
      "errors" = "ShopCatalogShadowAggregate"."errors" + EXCLUDED."errors",
      "durationTotalMs" = "ShopCatalogShadowAggregate"."durationTotalMs" + EXCLUDED."durationTotalMs",
      "durationMaxMs" = GREATEST("ShopCatalogShadowAggregate"."durationMaxMs", EXCLUDED."durationMaxMs"),
      "updatedAt" = NOW()
  `);
}

export async function recordShopCatalogShadowObservation(
  input: Parameters<typeof recordShopCatalogShadowObservationWithClient>[1]
) {
  return recordShopCatalogShadowObservationWithClient(prisma, input);
}

export async function readShopCatalogShadowEvidenceWithClient(
  client: ShadowTelemetryClient,
  input: { deploymentCommit: string; since: Date }
) {
  if (!/^[a-f0-9]{40}$/i.test(input.deploymentCommit) || !Number.isFinite(input.since.getTime())) {
    throw new TypeError("Shadow evidence requires a full commit SHA and valid start time");
  }
  const rows = await client.shopCatalogShadowAggregate.findMany({
    where: {
      deploymentCommit: input.deploymentCommit.toLowerCase(),
      bucketStart: { gte: hourBucket(input.since) },
    },
    orderBy: [
      { bucketStart: "asc" },
      { locale: "asc" },
      { brandKey: "asc" },
      { categoryKey: "asc" },
    ],
  });
  const sampledRequests = rows.reduce((sum, row) => sum + row.sampledRequests, 0);
  const mismatches = rows.reduce((sum, row) => sum + row.mismatches, 0);
  const errors = rows.reduce((sum, row) => sum + row.errors, 0);
  const durationTotalMs = rows.reduce((sum, row) => sum + row.durationTotalMs, BigInt(0));
  return Object.freeze({
    deploymentCommit: input.deploymentCommit.toLowerCase(),
    since: hourBucket(input.since).toISOString(),
    sampledRequests,
    mismatches,
    errors,
    errorRate: sampledRequests ? errors / sampledRequests : 0,
    durationAverageMs: sampledRequests ? Number(durationTotalMs) / sampledRequests : 0,
    durationMaxMs: rows.reduce((max, row) => Math.max(max, row.durationMaxMs), 0),
    segments: Object.freeze(
      rows.map((row) =>
        Object.freeze({
          bucketStart: row.bucketStart.toISOString(),
          locale: row.locale,
          brand: row.brandKey || null,
          category: row.categoryKey || null,
          sampledRequests: row.sampledRequests,
          mismatches: row.mismatches,
          errors: row.errors,
        })
      )
    ),
  });
}
