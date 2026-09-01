import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const telemetryModule = import("../../../src/lib/shopCatalogShadowTelemetry.server");

test("shadow telemetry accepts only full immutable deployment commits", async () => {
  const { resolveShopCatalogDeploymentCommit } = await telemetryModule;
  assert.equal(resolveShopCatalogDeploymentCommit({ VERCEL_GIT_COMMIT_SHA: "a".repeat(40) }), "a".repeat(40));
  assert.equal(resolveShopCatalogDeploymentCommit({ GITHUB_SHA: "B".repeat(40) }), "b".repeat(40));
  assert.equal(resolveShopCatalogDeploymentCommit({ VERCEL_GIT_COMMIT_SHA: "main" }), null);
});

test("shadow telemetry migration constrains counters and commit identity", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260901020000_add_catalog_shadow_aggregates/migration.sql",
    "utf8"
  );
  assert.match(schema, /model ShopCatalogShadowAggregate/);
  assert.match(migration, /ShopCatalogShadowAggregate_nonnegative_check/);
  assert.match(migration, /ShopCatalogShadowAggregate_outcome_check/);
  assert.match(migration, /ShopCatalogShadowAggregate_commit_check/);
});

test("live shadow route persists bounded outcomes after the response", () => {
  const route = readFileSync("src/app/api/shop/stock/search/route.ts", "utf8");
  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /recordShopCatalogShadowObservation/);
  assert.match(route, /mismatch: !comparison\.parity/);
  assert.match(route, /catalog_v2_shadow_telemetry_persist_error/);
});
