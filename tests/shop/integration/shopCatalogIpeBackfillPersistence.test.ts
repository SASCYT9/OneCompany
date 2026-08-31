import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildIpeSourceRecordDraft, type IpeSnapshotProduct } from "../../../src/lib/shopCatalogIpeNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogIpeBackfill.server");
function snapshot(productId: string, variantId: string, sku: string, variantTitle: string): IpeSnapshotProduct { return { id: productId, slug: productId, sku, scope: "auto",
  title: { ua: "Audi RS4 (B9) Exhaust System", en: "Audi RS4 (B9) Exhaust System" }, collection: { ua: "Audi", en: "Audi" },
  tags: ["Audi", "RS4 (B9)", "2019", "2020", "opf", "fits-make:audi"], variants: [{ id: variantId, sku, title: variantTitle, optionValues: [variantTitle], isDefault: true }] }; }
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) { await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId,
  variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } }); }
test("iPE persists variant-first OPF and collision-safe duplicate SKU records", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString(), sharedSku = `IPE-DUP-${suffix}`;
  const { persistIpeSourceRecordPageWithClient } = await backfillModule;
  try { const drafts = [];
    for (const [index, variantTitle] of ["Downpipe (Non-OPF)", "Downpipe (OPF)"].entries()) { const productId = `ipe-${index}-${suffix}`, variantId = `${productId}-variant`; await createProduct(client, productId, variantId, sharedSku);
      drafts.push(buildIpeSourceRecordDraft({ product: snapshot(productId, variantId, sharedSku, variantTitle), sourceRevision: "ipe-v1" })); }
    const result = await persistIpeSourceRecordPageWithClient(client, { sourceKey: `ipe-${suffix}`, drafts }); assert.equal(result.inserted, 2);
    assert.equal(await client.shopCatalogSourceRecord.count({ where: { sourceId: result.sourceId } }), 2);
    const policies = await client.shopCatalogCompatibilityPolicy.findMany({ where: { sourceRecord: { sourceId: result.sourceId } }, orderBy: { productId: "asc" }, include: { clauses: { include: { constraints: { include: { values: true } } } } } });
    assert.equal(policies.length, 2); assert.ok(policies.every((policy) => policy.mode === "NEEDS_REVIEW"));
    const values = policies.map((policy) => policy.clauses[0]?.constraints.find((entry) => entry.dimension === "OPF_GPF")?.values[0]?.textValue).sort();
    assert.deepEqual(values, ["NON_OPF", "OPF"]); assert.ok(policies.every((policy) => policy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state === "UNKNOWN"));
  } finally { await client.$disconnect(); }
});
