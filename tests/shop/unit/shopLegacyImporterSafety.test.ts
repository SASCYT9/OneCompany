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

test("Atomic scheduler invokes the versioned endpoint instead of a direct database writer", () => {
  const cli = readWorkspaceFile("scripts/atomic-sync-cron.ts");
  const workflow = readWorkspaceFile(".github/workflows/atomic-sync-cron.yml");
  assert.match(cli, /api\/admin\/cron\/atomic-sync/);
  assert.match(cli, /CRON_SECRET/);
  assert.doesNotMatch(cli, /PrismaClient|shopProduct|DATABASE_URL/);
  assert.match(workflow, /api\/admin\/cron\/atomic-sync/);
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.doesNotMatch(workflow, /DATABASE_URL|DIRECT_URL|scripts\/atomic-sync-cron/);
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

test("storefront tag backfill publishes taxonomy and visibility revisions", () => {
  const source = readWorkspaceFile("src/app/api/admin/shop/products/backfill-storefront/route.ts");
  assert.match(source, /coordinateShopCatalogProductMutation/);
  assert.match(source, /changeDomains: \["TAXONOMY", "VISIBILITY"\]/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
});

test("manual fitment review publishes a FITMENT revision", () => {
  const source = readWorkspaceFile("src/app/api/admin/shop/fitment-review/[id]/route.ts");
  assert.match(source, /coordinateShopCatalogProductMutation/);
  assert.match(source, /changeDomains: \["FITMENT"\]/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.match(source, /runShopCatalogOutboxRuntime/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
});

test("single-product AI quality mutation atomically publishes Catalog V2 fitment", () => {
  const repository = readWorkspaceFile("src/lib/admin/oneAiQualityProductRepository.ts");
  const route = readWorkspaceFile(
    "src/app/api/admin/shop/ai-quality/products/[productId]/route.ts"
  );
  const wrapperStart = repository.indexOf("export async function mutateOneAiQualityProduct(");
  assert.ok(wrapperStart >= 0);
  assert.match(repository.slice(wrapperStart), /coordinateShopCatalogProductMutation/);
  assert.match(repository.slice(wrapperStart), /changeDomains: \["FITMENT"\]/);
  assert.match(repository.slice(wrapperStart), /buildShopCatalogAdminSnapshot/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
});

test("AI quality bulk keeps idempotency, knowledge, and Catalog V2 in one transaction", () => {
  const repository = readWorkspaceFile("src/lib/admin/oneAiQualityBulkRepository.ts");
  const route = readWorkspaceFile("src/app/api/admin/shop/ai-quality/bulk/apply/route.ts");
  assert.match(repository, /lockOrderedProducts/);
  assert.match(repository, /coordinateShopCatalogProductMutationInTransaction/);
  assert.match(repository, /changeDomains: \["FITMENT"\]/);
  assert.match(repository, /catalogOutboxIds/);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/);
  assert.match(route, /runShopCatalogOutboxRuntime/);
});

test("Urban GP CLI snapshot uses the explicit-client Catalog V2 writer", () => {
  const source = readWorkspaceFile("src/lib/urbanGpPortalSync.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /coordinateShopCatalogProductCreationWithClient/);
  assert.match(source, /catalogWriter\.archive/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.(?:upsert|updateMany)\(/);
});

test("Atomic EU price CLI groups product price mutations through Catalog V2", () => {
  const source = readWorkspaceFile("scripts/sync-atomic-eu-prices.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \["PRICE"\]/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct(?:Variant)?\.(?:update|updateMany)\(/);
});

test("Ducati Akrapovic price CLI publishes owned variants with the product revision", () => {
  const source = readWorkspaceFile("scripts/sync-amsducati-akrapovic-prices.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \["PRICE"\]/);
  assert.match(source, /productId: row\.id, id: \{ in: row\.variantIds \}/);
  assert.match(source, /updated\.count !== row\.variantIds\.length/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
});

test("Ducati Akrapovic catalog CLI versions update, create, and archive paths", () => {
  const source = readWorkspaceFile("scripts/sync-amsducati-akrapovic-catalog.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /coordinateShopCatalogProductCreationWithClient/);
  assert.match(source, /Variant set changed during Akrapovič catalog update/);
  assert.match(source, /archive-invalid-component/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.(?:create|update|upsert)\(/);
});

test("Urban reconcile CLI publishes normalization and archive plans", () => {
  const source = readWorkspaceFile("scripts/reconcile-urban-catalog.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \["VISIBILITY"\]/);
  assert.match(source, /"CONTENT", "FITMENT", "TAXONOMY", "VISIBILITY"/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.update\(/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
});

test("Urban UA editorial CLI publishes content and SEO revisions", () => {
  const source = readWorkspaceFile("scripts/curate-urban-ua-copy.ts");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \[["']CONTENT["'], ["']SEO["']\]/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.update\(/);
});

test("runtime media migration groups all product-owned references into MEDIA revisions", () => {
  const source = readWorkspaceFile("scripts/migrate-runtime-media-to-blob.ts");
  assert.match(source, /const groups = new Map/);
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \[['"]MEDIA['"]\]/);
  assert.match(source, /Media ownership changed/);
  assert.match(source, /Variant ownership changed/);
  assert.doesNotMatch(source, /prisma\.shopProduct(?:Media|Variant)?\.updateMany\(/);
});

test("active IPE importer publishes ID-preserving update and creation paths", () => {
  const source = readWorkspaceFile("scripts/import-ipe-catalog.ts");
  assert.match(source, /adminProductImportMergeSelect/);
  assert.match(source, /buildAdminProductSnapshotMergeUpdateData/);
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /coordinateShopCatalogProductCreationWithClient/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.(?:create|update)\(/);
});

test("active Eventuri importer versions repair, draft, creation, and publish paths", () => {
  const source = readWorkspaceFile("scripts/import-eventuri-catalog.ts");
  assert.match(source, /eventuriImportProductSelect/);
  assert.match(source, /buildAdminProductSnapshotMergeUpdateData/);
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /coordinateShopCatalogProductCreationWithClient/);
  assert.match(source, /eventuri\.fitment-repair/);
  assert.match(source, /eventuri\.publish-approved/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.(?:create|update)\(/);
  assert.doesNotMatch(source, /prisma\.\$transaction/);
});

test("Brabus Blob migration groups every owned image reference into MEDIA revisions", () => {
  const source = readWorkspaceFile("scripts/migrate-brabus-images-to-blob.ts");
  assert.match(source, /const groups = new Map/);
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \[['"]MEDIA['"]\]/);
  assert.match(source, /Media ownership changed/);
  assert.match(source, /Variant ownership changed/);
  assert.doesNotMatch(source, /prisma\.shopProduct(?:Media|Variant)?\.updateMany\(/);
});

test("Atomic EN translation command runs with TS support and publishes content revisions", () => {
  const source = readWorkspaceFile("scripts/translate-atomic-products-en.js");
  const manifest = readWorkspaceFile("package.json");
  assert.match(source, /coordinateShopCatalogProductMutationWithClient/);
  assert.match(source, /changeDomains: \['CONTENT', 'SEO'\]/);
  assert.match(source, /buildShopCatalogAdminSnapshot/);
  assert.doesNotMatch(source, /prisma\.shopProduct\.update\(/);
  assert.match(manifest, /shop:translate-atomic-en[^\n]+run-react-server-tsx\.mjs/);
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
