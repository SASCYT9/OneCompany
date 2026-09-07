import assert from "node:assert/strict";
import { registerHooks } from "../unit/testHooks.mjs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  buildFiCanonicalDraft,
  type FiFitmentEntry,
  type FiSourceProduct,
} from "../../../src/lib/shopCatalogFiDraft";
import { buildFiPolicyEvidence } from "../../../src/lib/shopCatalogFiPolicyEvidence";
import { buildKwCanonicalProductDraft } from "../../../src/lib/shopCatalogKwDraft";
import { normalizeKwShopifyCatalog } from "../../../src/lib/shopCatalogKwNormalization";
import { buildKwPolicyEvidence } from "../../../src/lib/shopCatalogKwPolicyEvidence";
import type { ShopifySnapshotProduct } from "../../../src/lib/shopifyCatalogSnapshot";

const databaseUrl =
  process.env.CATALOG_EPHEMERAL_TEST === "1" ? process.env.OPS_TEST_DATABASE_URL : undefined;
if (
  databaseUrl &&
  (!["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
    process.env.DATABASE_URL !== databaseUrl)
) {
  throw new Error(
    "Catalog import evidence integration requires the same explicitly disposable localhost database"
  );
}

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const fiWriterModule = import("../../../src/lib/shopCatalogFiImportWriter.server");
const kwWriterModule = import("../../../src/lib/shopCatalogKwImportWriter.server");

function fiProduct(id: number, suffix: string): FiSourceProduct {
  return {
    id,
    title: "Fi Exhaust valvetronic system",
    handle: `fi-evidence-${suffix}`,
    body_html: "<p>Valvetronic exhaust system</p>",
    published_at: null,
    created_at: "2026-09-07T00:00:00.000Z",
    updated_at: "2026-09-07T00:00:00.000Z",
    vendor: "Fi EXHAUST",
    product_type: "Exhaust",
    tags: ["Fi EXHAUST", "BMW"],
    variants: [
      {
        id: id + 1,
        title: "Default",
        sku: `FI-${suffix}`,
        available: true,
        price: "1000.00",
        compare_at_price: null,
        position: 1,
      },
    ],
    images: [
      {
        id: id + 2,
        position: 1,
        src: `https://example.test/fi-${suffix}.jpg`,
        width: 1200,
        height: 800,
      },
    ],
  };
}

function fiFitment(product: FiSourceProduct, model = "M5"): FiFitmentEntry {
  return {
    id: String(product.id),
    handle: product.handle,
    status: "CSV_CORRELATED",
    applications: [{ brand: "BMW", model, body: "G90" }],
  };
}

function kwProduct(suffix: string): ShopifySnapshotProduct {
  return {
    id: `gid://shopify/Product/kw-evidence-${suffix}`,
    vendor: "KW",
    title: "KW Variant 3 BMW 3 Series",
    handle: `kw-evidence-${suffix}`,
    descriptionHtml: "<p>KW Variant 3</p>",
    productType: "Койловерна підвіска",
    status: "ACTIVE",
    updatedAt: "2026-09-07T00:00:00.000Z",
    tags: ["brand:BMW", "veh:3 (G20 G80) 11/2018-"],
    variants: [
      {
        id: `gid://shopify/ProductVariant/kw-evidence-${suffix}-one`,
        title: "Street",
        sku: `KW-${suffix}-1`,
        barcode: `BAR-${suffix}-1`,
        position: 1,
        inventoryQuantity: 3,
        inventoryPolicy: "DENY",
        price: "1200.00",
        compareAtPrice: null,
        selectedOptions: [{ value: "Street" }, { value: "Black" }],
      },
      {
        id: `gid://shopify/ProductVariant/kw-evidence-${suffix}-two`,
        title: "Track",
        sku: `KW-${suffix}-2`,
        position: 2,
        inventoryQuantity: 0,
        inventoryPolicy: "CONTINUE",
        price: "1300.00",
        compareAtPrice: null,
        selectedOptions: [{ value: "Track" }],
      },
    ],
    media: [
      {
        id: `gid://shopify/MediaImage/kw-evidence-${suffix}`,
        mediaContentType: "IMAGE",
        alt: "KW kit",
        image: { url: `https://example.test/kw-${suffix}.jpg` },
      },
    ],
    metafields: [
      {
        id: `gid://shopify/Metafield/kw-evidence-${suffix}`,
        namespace: "custom",
        key: "custom_price_eur",
        value: "900.00",
        type: "number_decimal",
      },
    ],
    options: [
      {
        id: `gid://shopify/ProductOption/kw-evidence-${suffix}`,
        name: "Setup",
        position: 1,
        optionValues: [{ name: "Street" }, { name: "Track" }],
      },
    ],
  };
}

test(
  "FI import persists immutable fitment evidence, replays idempotently, and locks concurrent inserts",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sourceProduct = fiProduct(9_000_000_000 + Math.floor(Math.random() * 10_000), suffix);
    const concurrentProduct = fiProduct(sourceProduct.id + 100_000, `${suffix}-concurrent`);
    try {
      const { ensureFiImportDependencies, insertFiDraftWithClient } = await fiWriterModule;
      const dependencies = await ensureFiImportDependencies(client);
      const fitment = fiFitment(sourceProduct);
      const draft = buildFiCanonicalDraft(sourceProduct, fitment);
      const evidence = buildFiPolicyEvidence({ product: sourceProduct, fitment }).sourceRecord;
      const staleRawProduct: FiSourceProduct = {
        ...sourceProduct,
        variants: [{ ...sourceProduct.variants[0]!, price: "1100.00" }],
      };
      await assert.rejects(
        () =>
          insertFiDraftWithClient({
            client,
            draft,
            rawProduct: staleRawProduct,
            fitment,
            dependencies,
          }),
        /draft source is stale/
      );
      assert.equal(await client.shopProduct.count({ where: { slug: draft.product.slug } }), 0);
      const inserted = await insertFiDraftWithClient({
        client,
        draft,
        rawProduct: sourceProduct,
        fitment,
        dependencies,
      });
      assert.equal(inserted.status, "inserted");
      const record = await client.shopCatalogSourceRecord.findFirstOrThrow({
        where: { productId: inserted.productId },
        select: { recordKey: true, sourceRevision: true, payloadHash: true, rawPayload: true },
      });
      assert.equal(record.recordKey, evidence.recordKey);
      assert.equal(record.sourceRevision, evidence.sourceRevision);
      assert.equal(record.payloadHash, evidence.payloadHash);
      assert.deepEqual(record.rawPayload, evidence.rawPayload);
      assert.deepEqual((record.rawPayload as { fitment: FiFitmentEntry }).fitment, fitment);

      const replay = await insertFiDraftWithClient({
        client,
        draft,
        rawProduct: sourceProduct,
        fitment,
        dependencies,
      });
      assert.deepEqual(replay, { status: "idempotent", productId: inserted.productId });
      const changedFitment = fiFitment(sourceProduct, "M3");
      await assert.rejects(
        () =>
          insertFiDraftWithClient({
            client,
            draft: buildFiCanonicalDraft(sourceProduct, changedFitment),
            rawProduct: sourceProduct,
            fitment: changedFitment,
            dependencies,
          }),
        /reviewed source revision promotion/
      );
      assert.equal(await client.shopProduct.count({ where: { id: inserted.productId } }), 1);
      assert.equal(
        (
          await client.shopCatalogSourceRecord.findFirstOrThrow({
            where: { productId: inserted.productId },
            select: { payloadHash: true },
          })
        ).payloadHash,
        evidence.payloadHash
      );

      const concurrentFitment = fiFitment(concurrentProduct);
      const concurrentDraft = buildFiCanonicalDraft(concurrentProduct, concurrentFitment);
      const results = await Promise.all([
        insertFiDraftWithClient({
          client,
          draft: concurrentDraft,
          rawProduct: concurrentProduct,
          fitment: concurrentFitment,
          dependencies,
        }),
        insertFiDraftWithClient({
          client,
          draft: concurrentDraft,
          rawProduct: concurrentProduct,
          fitment: concurrentFitment,
          dependencies,
        }),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), ["idempotent", "inserted"]);
      assert.equal(results[0].productId, results[1].productId);
      const concurrentProductId = results[0].productId;
      assert.equal(await client.shopProduct.count({ where: { id: concurrentProductId } }), 1);
    } finally {
      await client.$disconnect();
    }
  }
);

test(
  "KW import persists normalized evidence and binds nested variant provenance by external ID",
  { skip: !databaseUrl },
  async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const rawProduct = kwProduct(suffix);
    const normalization = normalizeKwShopifyCatalog([rawProduct])[0]!;
    const draft = buildKwCanonicalProductDraft({
      product: rawProduct,
      normalization,
      enTranslations: [{ key: "title", value: "KW Variant 3 BMW 3 Series" }],
    });
    try {
      const { ensureKwImportDependencies, insertKwDraftWithClient } = await kwWriterModule;
      const dependencies = await ensureKwImportDependencies(client);
      const evidence = buildKwPolicyEvidence({
        product: rawProduct,
        normalization,
        productId: draft.source.externalProductId,
      }).sourceRecord;
      const staleRawProduct: ShopifySnapshotProduct = {
        ...rawProduct,
        title: "KW Variant 3 BMW 3 Series revised",
      };
      await assert.rejects(
        () => insertKwDraftWithClient({ client, draft, rawProduct: staleRawProduct, dependencies }),
        /draft source is stale/
      );
      assert.equal(await client.shopProduct.count({ where: { slug: draft.product.slug } }), 0);
      const inserted = await insertKwDraftWithClient({ client, draft, rawProduct, dependencies });
      assert.equal(inserted.status, "inserted");
      const record = await client.shopCatalogSourceRecord.findFirstOrThrow({
        where: { productId: inserted.productId },
        select: {
          id: true,
          recordKey: true,
          sourceRevision: true,
          payloadHash: true,
          rawPayload: true,
        },
      });
      assert.equal(record.recordKey, rawProduct.id);
      assert.equal(record.sourceRevision, evidence.sourceRevision);
      assert.equal(record.payloadHash, evidence.payloadHash);
      assert.deepEqual(record.rawPayload, evidence.rawPayload);
      assert.deepEqual(
        (record.rawPayload as { normalization: typeof normalization }).normalization,
        normalization
      );

      const externalVariantIds = rawProduct.variants.map((variant) => variant.id!);
      const bindings = await client.shopCatalogSourceBinding.findMany({
        where: {
          sourceId: dependencies.sourceId,
          entityType: "VARIANT",
          externalKey: { in: externalVariantIds },
        },
        select: { externalKey: true, variantId: true },
      });
      const localVariantByExternal = new Map(
        bindings.map((binding) => [binding.externalKey, binding.variantId!])
      );
      const provenance = await client.shopCatalogFieldProvenance.findMany({
        where: {
          sourceRecordId: record.id,
          fieldPath: { in: ["product.variants.selectedOptions.value", "product.variants.barcode"] },
        },
        orderBy: [{ fieldPath: "asc" }, { ordinal: "asc" }],
        select: { fieldPath: true, ordinal: true, variantId: true },
      });
      assert.deepEqual(
        provenance
          .filter((row) => row.fieldPath === "product.variants.selectedOptions.value")
          .map((row) => row.variantId),
        [
          localVariantByExternal.get(externalVariantIds[0]!),
          localVariantByExternal.get(externalVariantIds[0]!),
          localVariantByExternal.get(externalVariantIds[1]!),
        ]
      );
      assert.deepEqual(
        provenance
          .filter((row) => row.fieldPath === "product.variants.barcode")
          .map((row) => row.variantId),
        [localVariantByExternal.get(externalVariantIds[0]!)]
      );

      const replay = await insertKwDraftWithClient({ client, draft, rawProduct, dependencies });
      assert.deepEqual(replay, { status: "idempotent", productId: inserted.productId });
      const changedNormalization = {
        ...normalization,
        issues: [...normalization.issues, "manual-review"],
      };
      const changedDraft = buildKwCanonicalProductDraft({
        product: rawProduct,
        normalization: changedNormalization,
        enTranslations: [{ key: "title", value: "KW Variant 3 BMW 3 Series" }],
      });
      await assert.rejects(
        () => insertKwDraftWithClient({ client, draft: changedDraft, rawProduct, dependencies }),
        /reviewed source revision promotion/
      );
      assert.equal(await client.shopProduct.count({ where: { id: inserted.productId } }), 1);
      assert.equal(
        (
          await client.shopCatalogSourceRecord.findFirstOrThrow({
            where: { productId: inserted.productId },
            select: { payloadHash: true },
          })
        ).payloadHash,
        evidence.payloadHash
      );
    } finally {
      await client.$disconnect();
    }
  }
);
