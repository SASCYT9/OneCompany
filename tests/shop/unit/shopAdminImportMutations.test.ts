import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminProductImportUpdateData,
  buildAdminProductSnapshotMergeUpdateData,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
  type AdminProductImportMergeRecord,
  type AdminProductImportRelationMask,
} from "../../../src/lib/shopAdminCatalog";

const currentProduct: AdminProductImportMergeRecord = {
  id: "product-1",
  slug: "safe-product",
  collections: [{ collectionId: "collection-existing", sortOrder: 0 }],
  media: [{ id: "media-1", src: "https://cdn.example.com/product.jpg", position: 1 }],
  options: [{ id: "option-1", name: "Finish", position: 1 }],
  variants: [
    {
      id: "variant-1",
      sku: "SAFE-001",
      title: "Gloss",
      position: 1,
      option1Value: "Gloss",
      option2Value: null,
      option3Value: null,
      isDefault: true,
    },
    {
      id: "variant-unmentioned",
      sku: "SAFE-002",
      title: "Matte",
      position: 2,
      option1Value: "Matte",
      option2Value: null,
      option3Value: null,
      isDefault: false,
    },
  ],
  metafields: [
    { id: "metafield-1", namespace: "custom", key: "vehicle" },
    { id: "metafield-unmentioned", namespace: "custom", key: "keep_me" },
  ],
};

const omittedRelations: AdminProductImportRelationMask = {
  tags: false,
  collections: false,
  media: false,
  options: false,
  variants: false,
  metafields: false,
};

test("partial import update preserves every omitted nested relation", () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: "safe-product",
    titleUa: "Оновлена назва",
    titleEn: "Updated title",
  });
  assert.deepEqual(errors, []);
  assert.equal(data.variants.length, 1, "normalization injects a default variant");

  const update = buildAdminProductImportUpdateData(data, currentProduct, omittedRelations);

  assert.equal(update.collections, undefined);
  assert.equal(update.media, undefined);
  assert.equal(update.options, undefined);
  assert.equal(update.variants, undefined);
  assert.equal(update.metafields, undefined);
  assert.equal(update.category, undefined);
  assert.equal(update.tags, undefined);
  assert.equal(update.image, undefined);
  assert.equal(update.gallery, undefined);
  assert.throws(
    () => buildAdminProductUpdateData(data),
    /Unsafe full relation replacement is disabled/i
  );
});

test("import merge updates matched relation ids in place and never deletes unmentioned variants", () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: "safe-product",
    titleUa: "Безпечний товар",
    titleEn: "Safe product",
    collectionIds: ["collection-new"],
    media: [{ src: "https://cdn.example.com/product.jpg", altText: "Updated" }],
    options: [{ name: "Finish", position: 1, values: ["Gloss", "Matte"] }],
    variants: [
      {
        sku: "safe-001",
        title: "Gloss updated",
        option1Value: "Gloss",
        inventoryQty: 7,
      },
    ],
    metafields: [
      {
        namespace: "custom",
        key: "vehicle",
        value: "Updated fitment",
      },
    ],
  });
  assert.deepEqual(errors, []);

  const update = buildAdminProductImportUpdateData(data, currentProduct, {
    tags: false,
    collections: true,
    media: true,
    options: true,
    variants: true,
    metafields: true,
  }) as {
    media: { update: Array<{ where: { id: string } }> };
    options: { update: Array<{ where: { id: string } }> };
    variants: { update: Array<{ where: { id: string } }> };
    metafields: { update: Array<{ where: { id: string } }> };
    collections: {
      upsert: Array<{
        where: { productId_collectionId: { productId: string; collectionId: string } };
      }>;
    };
  };

  assert.equal(update.media.update[0].where.id, "media-1");
  assert.equal(update.options.update[0].where.id, "option-1");
  assert.equal(update.variants.update[0].where.id, "variant-1");
  assert.equal(update.metafields.update[0].where.id, "metafield-1");
  assert.equal(update.collections.upsert[0].where.productId_collectionId.productId, "product-1");
  assert.equal(
    update.collections.upsert[0].where.productId_collectionId.collectionId,
    "collection-new"
  );
  assert.equal(JSON.stringify(update).includes("deleteMany"), false);
  assert.equal(JSON.stringify(update).includes("variant-unmentioned"), false);
});

test("supplier snapshot merge preserves ids and does not erase media after an empty media pass", () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: "safe-product",
    titleUa: "Безпечний товар",
    titleEn: "Safe product",
    variants: [{ sku: "SAFE-001", title: "Gloss updated", inventoryQty: 4 }],
    media: [],
    image: null,
  });
  assert.deepEqual(errors, []);

  const update = buildAdminProductSnapshotMergeUpdateData(data, currentProduct) as {
    image?: unknown;
    gallery?: unknown;
    media?: unknown;
    variants: { update: Array<{ where: { id: string } }> };
  };

  assert.equal(update.image, undefined);
  assert.equal(update.gallery, undefined);
  assert.equal(update.media, undefined);
  assert.equal(update.variants.update[0]?.where.id, "variant-1");
  assert.equal(JSON.stringify(update).includes("deleteMany"), false);
});

test("legacy single-variant importer snapshots update media and variant ids in place", () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: "safe-product",
    titleUa: "Оновлений товар",
    titleEn: "Updated product",
    brand: "Burger Motorsports",
    image: "https://cdn.example.com/product.jpg",
    media: [{ src: "https://cdn.example.com/product.jpg", altText: "Updated" }],
    variants: [{ sku: "SAFE-001", title: "Default", priceEur: 450 }],
  });
  assert.deepEqual(errors, []);

  const update = buildAdminProductSnapshotMergeUpdateData(data, currentProduct) as {
    media: { update: Array<{ where: { id: string } }> };
    variants: { update: Array<{ where: { id: string } }> };
  };

  assert.equal(update.media.update[0]?.where.id, "media-1");
  assert.equal(update.variants.update[0]?.where.id, "variant-1");
  assert.equal(JSON.stringify(update).includes("deleteMany"), false);
});

test("import merge fails closed when a variant SKU cannot identify one existing id", () => {
  const { data } = normalizeAdminProductPayload({
    slug: "safe-product",
    titleUa: "Безпечний товар",
    titleEn: "Safe product",
    variants: [{ sku: "DUPLICATE", title: "Incoming" }],
  });
  const ambiguous: AdminProductImportMergeRecord = {
    ...currentProduct,
    variants: currentProduct.variants.map((variant) => ({ ...variant, sku: "DUPLICATE" })),
  };

  assert.throws(
    () =>
      buildAdminProductImportUpdateData(data, ambiguous, {
        ...omittedRelations,
        variants: true,
      }),
    /Ambiguous variant SKU/i
  );
});
