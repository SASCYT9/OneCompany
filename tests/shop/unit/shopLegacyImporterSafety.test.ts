import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const TARGETS = [
  "src/app/api/import-brabus/route.ts",
  "scripts/brabus-import.mjs",
  "src/app/api/import-burger/route.ts",
  "scripts/reimport-burger.ts",
  "scripts/import-do88.ts",
  "scripts/import-akrapovic-moto.ts",
] as const;

function readWorkspaceFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("catalog importers cannot delete and recreate persisted relation ids", () => {
  for (const relativePath of TARGETS) {
    const source = readWorkspaceFile(relativePath);
    assert.doesNotMatch(source, /\bdeleteMany\b/, `${relativePath} still contains deleteMany`);
    assert.doesNotMatch(
      source,
      /shopProduct(?:Variant|Media|Metafield)\.delete\b/,
      `${relativePath} still deletes persisted product relations`
    );
  }
});

test("supported legacy routes and Akrapovic Moto use the shared identity merge", () => {
  for (const relativePath of [
    "src/app/api/import-brabus/route.ts",
    "src/app/api/import-burger/route.ts",
    "scripts/import-akrapovic-moto.ts",
  ]) {
    const source = readWorkspaceFile(relativePath);
    assert.match(source, /adminProductImportMergeSelect/, `${relativePath} must load relation ids`);
    assert.match(
      source,
      /buildAdminProduct(?:SnapshotMergeUpdate|ImportUpdate)Data/,
      `${relativePath} must use the shared ID-preserving merge`
    );
  }
});

test("live do88 admin import publishes through the central catalog writer", () => {
  const source = readWorkspaceFile("src/app/api/admin/shop/do88-import/route.ts");
  assert.match(source, /prismaShopCsvCatalogWriter\.update/);
  assert.match(source, /prismaShopCsvCatalogWriter\.create/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.(?:create|update)\(/);
});

test("SKU fallback importers fail closed instead of selecting an ambiguous product", () => {
  const brabus = readWorkspaceFile("src/app/api/import-brabus/route.ts");
  const akrapovic = readWorkspaceFile("scripts/import-akrapovic-moto.ts");

  for (const source of [brabus, akrapovic]) {
    assert.match(source, /findMany\(/);
    assert.match(source, /take: 2/);
    assert.match(source, /Ambiguous .* product SKU/);
  }
  assert.match(brabus, /requires a non-empty SKU/);
  assert.doesNotMatch(akrapovic, /shopProduct\.findFirst\(\{\s*where: \{ sku \}/);
});

test("obsolete live CLIs fail closed and Brabus dry-run remains read-only", () => {
  const brabus = readWorkspaceFile("scripts/brabus-import.mjs");
  const burger = readWorkspaceFile("scripts/reimport-burger.ts");
  const do88 = readWorkspaceFile("scripts/import-do88.ts");

  for (const [relativePath, source] of [
    ["scripts/brabus-import.mjs", brabus],
    ["scripts/reimport-burger.ts", burger],
    ["scripts/import-do88.ts", do88],
  ] as const) {
    assert.match(
      source,
      /LEGACY_LIVE_IMPORT_DISABLED/,
      `${relativePath} needs a fail-close marker`
    );
    assert.match(source, /throw new Error\(LEGACY_LIVE_IMPORT_DISABLED\)/);
  }

  assert.match(brabus, /args\.includes\('--dry-run'\)/);
  const mainStart = brabus.indexOf("async function main");
  const liveGuard = brabus.indexOf("if (!isDryRun)", mainStart);
  const sourceRead = brabus.indexOf("JSON.parse(readFileSync");
  assert.ok(
    liveGuard >= 0 && sourceRead > liveGuard,
    "Brabus live mode must fail before source reads"
  );
  assert.doesNotMatch(brabus, /new PrismaClient|@prisma\/client/);
  assert.doesNotMatch(burger, /prisma|@prisma\/client/i);
  assert.doesNotMatch(do88, /prisma|@prisma\/client/i);
});
