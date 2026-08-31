import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildCsfSourceRecordDraft, type CsfSnapshotProduct } from "../../../src/lib/shopCatalogCsfNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogCsfBackfill.server");
test("CSF persists correlated chassis and exact manual transmission without broad engine match", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString(), productId = `csf-${suffix}`, variantId = `${productId}-variant`, sku = `CSF-${suffix}`;
  const { persistCsfSourceRecordPageWithClient } = await backfillModule;
  try { await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId, variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } });
    const title = "CSF Radiator for PORSCHE 944 Turbo (951) 1985-1991"; const product: CsfSnapshotProduct = { id: productId, slug: productId, sku, scope: "auto", title: { ua: title, en: title }, category: { ua: "Радіатори та аксесуари", en: "Radiators" }, stock: "inStock", tags: ["fits-make:porsche"],
      longDescription: { en: "Applications: 1985-1991 Porsche 944 Turbo – Manual Transmission Only" }, variants: [{ id: variantId, sku, isDefault: true }] };
    const draft = buildCsfSourceRecordDraft({ product, sourceRevision: "csf-v1" }); await persistCsfSourceRecordPageWithClient(client, { sourceKey: `csf-${suffix}`, drafts: [draft] });
    const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}` }, include: { clauses: { include: { constraints: { include: { values: true } } } } } });
    assert.equal(policy.mode, "NEEDS_REVIEW"); const clause = policy.clauses[0]!;
    assert.equal(clause.constraints.find((entry) => entry.dimension === "CHASSIS")?.values[0]?.textValue, "951");
    assert.equal(clause.constraints.find((entry) => entry.dimension === "TRANSMISSION")?.values[0]?.textValue, "MANUAL");
    assert.equal(clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state, "UNKNOWN");
  } finally { await client.$disconnect(); }
});
