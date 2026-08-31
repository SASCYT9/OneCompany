import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildOhlinsSourceRecordDraft, type OhlinsSnapshotProduct } from "../../../src/lib/shopCatalogOhlinsNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogOhlinsBackfill.server");
function snapshot(productId: string, variantId: string, sku: string, title: string, tags: string[]): OhlinsSnapshotProduct {
  return { id: productId, slug: productId, sku, scope: "auto", title: { ua: title, en: title }, shortDescription: { ua: "", en: "" }, tags,
    gallery: [], variants: [{ id: variantId, sku, isDefault: true }] };
}
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId,
    variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } });
}
test("Ohlins persists exact chassis, universal parts, and review-only drivetrain qualifiers", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString();
  const { persistOhlinsSourceRecordPageWithClient } = await backfillModule;
  try {
    const cases = [
      { key: "exact", title: "OHLINS BMW M2 (G87) / M3 (G80) / M4 (G82)", tags: ["fits-make:bmw"], expected: "VEHICLE_SPECIFIC" },
      { key: "universal", title: "OHLINS Rubber Bushing", tags: ["fits-make:universal"], expected: "UNIVERSAL" },
      { key: "review", title: "OHLINS BMW M3 (G80) RWD Only", tags: ["fits-make:bmw"], expected: "NEEDS_REVIEW" },
    ];
    for (const item of cases) {
      const productId = `ohlins-${item.key}-${suffix}`, variantId = `${productId}-variant`, sku = `OHL-${item.key}-${suffix}`;
      await createProduct(client, productId, variantId, sku);
      const draft = buildOhlinsSourceRecordDraft({ product: snapshot(productId, variantId, sku, item.title, item.tags), sourceRevision: "ohlins-v1" });
      await persistOhlinsSourceRecordPageWithClient(client, { sourceKey: `ohlins-${item.key}-${suffix}`, drafts: [draft] });
      const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}` }, include: { clauses: { include: { constraints: true } } } });
      assert.equal(policy.mode, item.expected);
      assert.ok(policy.clauses.every((clause) => clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state === "NOT_APPLICABLE"));
      if (item.key === "exact") assert.deepEqual(policy.clauses.map((clause) => clause.constraints.find((entry) => entry.dimension === "CHASSIS")?.state), ["EXACT", "EXACT", "EXACT"]);
    }
  } finally { await client.$disconnect(); }
});
