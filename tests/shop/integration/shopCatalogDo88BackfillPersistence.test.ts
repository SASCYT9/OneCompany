import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildDo88SourceRecordDraft, type Do88SnapshotProduct } from "../../../src/lib/shopCatalogDo88Normalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogDo88Backfill.server");
function snapshot(productId: string, variantId: string, sku: string, title: string, tags: string[]): Do88SnapshotProduct { return { id: productId, slug: productId, sku, scope: "SHOP", title: { ua: title, en: title }, tags, variants: [{ id: variantId, sku, isDefault: true }] }; }
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) { await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId, variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } }); }
test("do88 persists exact fitment, universal parts, and quarantines invalid makes", { skip: !databaseUrl }, async () => { const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString(), { persistDo88SourceRecordPageWithClient } = await backfillModule;
  try { const cases = [
    { key: "vehicle", title: "Volvo S60R hose", tags: ["Vehicle Specific", "fits-make:volvo", "Volvo S60 V70 S80 XC70, P2 (2000-2009)"], mode: "VEHICLE_SPECIFIC" },
    { key: "universal", title: "Fuel Hose 10 mm", tags: ["Hoses & Couplers", "Fuel Hose"], mode: "UNIVERSAL" },
    { key: "invalid", title: "Clamp kit", tags: ["Vehicle Specific", "fits-make:clamp-kits"], mode: "NEEDS_REVIEW" },
  ];
    for (const item of cases) { const productId = `do88-${item.key}-${suffix}`, variantId = `${productId}-variant`, sku = `D88-${item.key}-${suffix}`; await createProduct(client, productId, variantId, sku); const draft = buildDo88SourceRecordDraft({ product: snapshot(productId, variantId, sku, item.title, item.tags), sourceRevision: "do88-v1" });
      await persistDo88SourceRecordPageWithClient(client, { sourceKey: `do88-${item.key}-${suffix}`, drafts: [draft] }); const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}` }, include: { clauses: { include: { constraints: { include: { values: true } } } } } }); assert.equal(policy.mode, item.mode);
      if (item.key === "vehicle") { assert.equal(policy.clauses.length, 1); assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "CHASSIS")?.values[0]?.textValue, "P2"); assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN"); }
      if (item.key === "universal") { assert.equal(policy.clauses.length, 1); assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "SCOPE")?.values[0]?.textValue, "auto"); assert.equal(policy.clauses[0]?.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "NOT_APPLICABLE"); } }
  } finally { await client.$disconnect(); } });
