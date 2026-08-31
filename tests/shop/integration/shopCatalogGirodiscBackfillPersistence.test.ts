import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildGirodiscSourceRecordDraft, type GirodiscSnapshotProduct } from "../../../src/lib/shopCatalogGirodiscNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogGirodiscBackfill.server");
function snapshot(productId: string, variantId: string, sku: string, title: string, tags: string[]): GirodiscSnapshotProduct { return { id: productId, slug: productId, sku, scope: "SHOP", title: { ua: title, en: title }, tags, variants: [{ id: variantId, sku, isDefault: true }] }; }
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) { await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId, variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } }); }
test("GiroDisc persists correlated chassis and quarantines parent-only hardware", { skip: !databaseUrl }, async () => { const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString(), { persistGirodiscSourceRecordPageWithClient } = await backfillModule;
  try { const cases = [{ key: "vehicle", title: "GIRODISC Rotor for MERCEDES CLS63 (W218)/E63 (W212) 2012-2018", tags: ["car_make:mercedes"] }, { key: "parent", title: "GIRODISC Hardware Kit 8 Long Pins", tags: [] }];
    for (const item of cases) { const productId = `giro-${item.key}-${suffix}`, variantId = `${productId}-variant`, sku = `GD-${item.key}-${suffix}`; await createProduct(client, productId, variantId, sku); const draft = buildGirodiscSourceRecordDraft({ product: snapshot(productId, variantId, sku, item.title, item.tags), sourceRevision: "giro-v1" });
      await persistGirodiscSourceRecordPageWithClient(client, { sourceKey: `giro-${item.key}-${suffix}`, drafts: [draft] }); const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}` }, include: { clauses: { include: { constraints: { include: { values: true } } } } } });
      assert.equal(policy.mode, item.key === "vehicle" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW"); if (item.key === "vehicle") { assert.equal(policy.clauses.length, 2); assert.deepEqual(policy.clauses.map((clause) => clause.constraints.find((entry) => entry.dimension === "CHASSIS")?.values[0]?.textValue), ["W218", "W212"]); }
      assert.ok(policy.clauses.every((clause) => clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state === "NOT_APPLICABLE")); }
  } finally { await client.$disconnect(); } });
