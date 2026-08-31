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

test("live Brabus and Burger routes publish snapshot merges through the catalog adapter", () => {
  for (const relativePath of [
    "src/app/api/import-brabus/route.ts",
    "src/app/api/import-burger/route.ts",
  ]) {
    const source = readWorkspaceFile(relativePath);
    assert.match(source, /publishShopCatalogImportUpdate/);
    assert.match(source, /publishShopCatalogImportCreation/);
    assert.match(source, /runShopCatalogOutboxRuntime/);
    assert.doesNotMatch(source, /prisma\.shopProduct\.(?:create|update)\(/);
  }
});

test("Atomic feed cron groups variant updates behind product catalog locks", () => {
  const source = readWorkspaceFile("src/app/api/admin/cron/atomic-sync/route.ts");
  assert.match(source, /const byProduct = new Map/);
  assert.match(source, /publishShopCatalogImportUpdate/);
  assert.match(source, /publishShopCatalogImportCreation/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.shopProduct(?:Variant)?\.(?:create|update|updateMany)\(/);
});

test("Turn14 live hydration and sync publish through the central catalog writer", () => {
  const sharedSync = readWorkspaceFile("src/lib/turn14Sync.ts");
  assert.match(sharedSync, /publishShopCatalogImportUpdate/);
  assert.match(sharedSync, /publishShopCatalogImportCreation/);
  assert.doesNotMatch(
    sharedSync,
    /prisma\.shopProduct(?:Variant|Media)?\.(?:create|update|updateMany)\(/
  );

  for (const relativePath of [
    "src/app/api/admin/shop/turn14/import/route.ts",
    "src/app/api/admin/shop/turn14/sync/route.ts",
    "src/app/api/shop/cart/items/route.ts",
  ]) {
    assert.match(readWorkspaceFile(relativePath), /runShopCatalogOutboxRuntime/);
  }
});

test("Turn14 dimensions sync groups writes behind product catalog locks", () => {
  const sharedSync = readWorkspaceFile("src/lib/turn14ShippingSync.ts");
  const route = readWorkspaceFile("src/app/api/admin/shop/turn14/sync-dimensions/route.ts");
  const writer = readWorkspaceFile("src/lib/shopCatalogDimensionsWriter.server.ts");

  assert.match(sharedSync, /pendingByProduct/);
  assert.match(sharedSync, /publishShopCatalogDimensionsUpdate/);
  assert.doesNotMatch(sharedSync, /prisma\.shopProductVariant\.update\(/);
  assert.match(route, /publishShopCatalogDimensionsUpdate/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(route, /prisma\.shopProductVariant\.update\(/);
  assert.match(writer, /coordinateShopCatalogProductMutation/);
  assert.match(writer, /buildShopCatalogAdminSnapshot/);
});

test("AI SEO writes are validated and versioned through the catalog coordinator", () => {
  const source = readWorkspaceFile("src/app/api/admin/shop/seo-generate/route.ts");
  assert.match(source, /requiredSeoText/);
  assert.match(source, /coordinateShopCatalogProductMutation/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.update\(/);
});

test("Airtable stock cron rejects conflicting feed rows and publishes grouped inventory", () => {
  const source = readWorkspaceFile("src/app/api/admin/cron/airtable-stocks/route.ts");
  assert.match(source, /Conflicting Airtable inventory quantities/);
  assert.match(source, /const groups = new Map/);
  assert.match(source, /coordinateShopCatalogProductMutation/);
  assert.match(source, /changeDomains: \["INVENTORY"\]/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.shopProductVariant\.updateMany\(/);
});

test("Brabus cleanup is authenticated, preview-first, and versioned", () => {
  const source = readWorkspaceFile("src/app/api/clean-brabus/route.ts");
  const getStart = source.indexOf("export async function GET");
  const postStart = source.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart);
  assert.match(source.slice(getStart, postStart), /SHOP_PRODUCTS_READ/);
  assert.doesNotMatch(source.slice(getStart, postStart), /coordinateShopCatalogProductMutation/);
  assert.match(source.slice(postStart), /SHOP_PRODUCTS_WRITE/);
  assert.match(source.slice(postStart), /coordinateShopCatalogProductMutation/);
  assert.match(source.slice(postStart), /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.update\(/);
});

test("category derivation deduplicates category upserts and publishes taxonomy assignments", () => {
  const sharedSync = readWorkspaceFile("src/lib/shopAdminCategories.ts");
  const route = readWorkspaceFile("src/app/api/admin/shop/categories/sync-from-products/route.ts");
  assert.match(sharedSync, /const uniqueSeeds = new Map/);
  assert.match(sharedSync, /coordinateShopCatalogProductMutation/);
  assert.match(sharedSync, /changeDomains: \['TAXONOMY'\]/);
  assert.doesNotMatch(sharedSync, /prisma\.shopProduct\.update\(/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
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
