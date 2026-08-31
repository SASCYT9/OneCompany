import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildRemusSourceRecordDraft, type RemusSnapshotProduct } from "../../../src/lib/shopCatalogRemusNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogRemusBackfill.server");
function snapshot(id: string, sku: string, title: string, tags: string[]): RemusSnapshotProduct { return { id, slug: id, sku, scope: "auto", brand: "Remus", title: { ua: title, en: title }, tags, variants: [] }; }
test("Remus persists product-level year and OPF/GPF semantics", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString(); const { persistRemusSourceRecordPageWithClient } = await backfillModule;
  try { const cases = [
    { key: "gpf", title: "GPF-Back Exhaust for VW Golf", tags: ["fits-make:vw", "fits-model:vw:golf-7", "fits-year:2018"], mode: "VEHICLE_SPECIFIC" },
    { key: "universal", title: "Universal tip", tags: ["fits-make:universal"], mode: "UNIVERSAL" },
    { key: "review", title: "Exhaust for T-Roc", tags: [], mode: "NEEDS_REVIEW" },
  ]; for (const item of cases) { const productId = `remus-${item.key}-${suffix}`; await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId } }); const draft = buildRemusSourceRecordDraft({ product: snapshot(productId, `REM-${item.key}-${suffix}`, item.title, item.tags), sourceRevision: "rem-v1" }); await persistRemusSourceRecordPageWithClient(client, { sourceKey: `rem-${item.key}-${suffix}`, drafts: [draft] }); const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `product:${productId}` }, include: { clauses: { include: { constraints: { include: { values: true } } } } } }); assert.equal(policy.mode, item.mode); assert.equal(policy.variantId, null); const constraints = policy.clauses[0]?.constraints ?? []; if (item.key === "gpf") { assert.equal(constraints.find((entry) => entry.dimension === "YEAR")?.values[0]?.yearFrom, 2018); assert.equal(constraints.find((entry) => entry.dimension === "OPF_GPF")?.values[0]?.textValue, "OPF/GPF"); assert.equal(constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN"); } if (item.key === "universal") { assert.equal(constraints.find((entry) => entry.dimension === "ENGINE")?.state, "NOT_APPLICABLE"); assert.equal(constraints.find((entry) => entry.dimension === "OPF_GPF")?.state, "ANY"); } }
  } finally { await client.$disconnect(); }
});
