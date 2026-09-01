import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const telemetryModule = import("../../../src/lib/shopCatalogShadowTelemetry.server");

test("shadow aggregates retain concurrent samples, mismatches, errors, and segments", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const commit = "c".repeat(40);
  const observedAt = new Date("2026-09-01T08:34:00.000Z");
  try {
    const { recordShopCatalogShadowObservationWithClient, readShopCatalogShadowEvidenceWithClient } = await telemetryModule;
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        recordShopCatalogShadowObservationWithClient(client, {
          deploymentCommit: commit,
          locale: index % 2 ? "en" : "ua",
          brand: index % 2 ? "Eventuri" : "RaceChip",
          category: "performance",
          mismatch: index === 0,
          error: index === 1,
          durationMs: 10 + index,
          observedAt,
        })
      )
    );
    const evidence = await readShopCatalogShadowEvidenceWithClient(client, {
      deploymentCommit: commit,
      since: new Date("2026-09-01T08:01:00.000Z"),
    });
    assert.equal(evidence.sampledRequests, 20);
    assert.equal(evidence.mismatches, 1);
    assert.equal(evidence.errors, 1);
    assert.equal(evidence.errorRate, 0.05);
    assert.equal(evidence.durationMaxMs, 29);
    assert.equal(evidence.segments.length, 2);
  } finally {
    await client.$disconnect();
  }
});
