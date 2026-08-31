import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildAkrapovicSourceRecordDraft, type AkrapovicSnapshotProduct } from "../../../src/lib/shopCatalogAkrapovicNormalization";
const databaseUrl = process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
const serverOnlyStub = pathToFileURL(path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")).href;
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true }; return nextResolve(specifier, context); } });
const backfillModule = import("../../../src/lib/shopCatalogAkrapovicBackfill.server");
function snapshot(productId: string, variantId: string, sku: string, scope: "auto" | "moto", title: string, tags: string[]): AkrapovicSnapshotProduct {
  return { id: productId, slug: productId, sku, scope, brand: "AKRAPOVIC", title: { ua: title, en: title }, tags,
    gallery: [], variants: [{ id: variantId, sku, isDefault: true }] };
}
async function createProduct(client: PrismaClient, productId: string, variantId: string, sku: string) {
  await client.shopProduct.create({ data: { id: productId, slug: productId, titleUa: productId, titleEn: productId,
    variants: { create: { id: variantId, title: "Default", sku, isDefault: true } } } });
}
test("Akrapovic persists isolated auto/moto taxonomy and review-only exhaust", { skip: !databaseUrl }, async () => {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } }); const suffix = Date.now().toString();
  const { persistAkrapovicSourceRecordPageWithClient } = await backfillModule;
  try {
    const cases = [
      { key: "auto", scope: "auto" as const, title: "AKRAPOVIC Rear Diffuser for BMW M3 (G80)", tags: ["fits-make:bmw"], expected: "VEHICLE_SPECIFIC" },
      { key: "moto", scope: "moto" as const, title: "Akrapovic Adventure Footpeg Set for BMW R 1300 GS 2024-2026", tags: ["fits-make:bmw", "fits-year:2024", "fits-year:2025", "fits-year:2026"], expected: "VEHICLE_SPECIFIC" },
      { key: "review", scope: "auto" as const, title: "AKRAPOVIC Slip-On Exhaust for AUDI RS6 (C8) OPF", tags: ["fits-make:audi"], expected: "NEEDS_REVIEW" },
    ];
    for (const item of cases) {
      const productId = `akrapovic-${item.key}-${suffix}`, variantId = `${productId}-variant`, sku = `AKR-${item.key}-${suffix}`;
      await createProduct(client, productId, variantId, sku);
      const draft = buildAkrapovicSourceRecordDraft({ product: snapshot(productId, variantId, sku, item.scope, item.title, item.tags), sourceRevision: "akrapovic-v1" });
      await persistAkrapovicSourceRecordPageWithClient(client, { sourceKey: `akrapovic-${item.key}-${suffix}`, drafts: [draft] });
      const policy = await client.shopCatalogCompatibilityPolicy.findFirstOrThrow({ where: { targetKey: `variant:${variantId}` }, include: { clauses: { include: { constraints: { include: { values: true } } } } } });
      assert.equal(policy.mode, item.expected);
      assert.ok(policy.clauses.every((clause) => clause.constraints.find((entry) => entry.dimension === "SCOPE")?.values[0]?.textValue === item.scope));
      if (item.key === "review") assert.ok(policy.clauses.every((clause) => clause.constraints.find((entry) => entry.dimension === "ENGINE")?.state === "UNKNOWN"));
    }
    assert.equal(await client.vehicleMake.count({ where: { normalizedName: "bmw", scope: { in: ["auto", "moto"] } } }), 2);
    assert.ok(await client.vehicleMake.findUnique({ where: { makeKey: "auto:bmw" } }));
    assert.ok(await client.vehicleMake.findUnique({ where: { makeKey: "moto:bmw" } }));
  } finally { await client.$disconnect(); }
});
