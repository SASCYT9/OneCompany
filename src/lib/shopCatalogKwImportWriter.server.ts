import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { KwCanonicalProductDraft } from "./shopCatalogKwDraft";
import type { ShopifySnapshotProduct } from "./shopifyCatalogSnapshot";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

const CATEGORY_LABELS: Readonly<Record<string, { ua: string; en: string }>> = {
  coilovers: { ua: "Койловерна підвіска", en: "Coilovers" },
  "springs-and-sport-suspension": { ua: "Пружини та спортивна підвіска", en: "Springs and sport suspension" },
  "hydraulic-lift-system": { ua: "Гідравлічна система підйому підвіски", en: "Hydraulic lift systems" },
  "lift-kit": { ua: "Ліфт-комплект підвіски", en: "Lift kits" },
  damper: { ua: "Амортизатори", en: "Dampers" },
  "top-mount": { ua: "Верхні опори підвіски", en: "Top mounts" },
  "needs-review": { ua: "KW — потребує категоризації", en: "KW — category review" },
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dateValue(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value) : null;
}

export async function ensureKwImportDependencies(client: PrismaClient) {
  return client.$transaction(async (tx) => {
    const source = await tx.shopCatalogSource.upsert({
      where: { key: "shopify-kw-suspensions" },
      create: { key: "shopify-kw-suspensions", displayName: "KW Suspensions Shopify", kind: "INTEGRATION", priority: 40 },
      update: { displayName: "KW Suspensions Shopify", kind: "INTEGRATION", isActive: true },
    });
    const brand = await tx.shopBrand.upsert({
      where: { key: "kw-suspensions" },
      create: { key: "kw-suspensions", name: "KW Suspensions", nameUa: "KW Suspensions", nameEn: "KW Suspensions" },
      update: { name: "KW Suspensions", isActive: true },
    });
    for (const alias of ["KW", "KW Automotive Ukraine", "KW Suspensions"]) {
      await tx.shopBrandAlias.upsert({
        where: { sourceId_normalizedAlias: { sourceId: source.id, normalizedAlias: alias.trim().toLowerCase() } },
        create: { sourceId: source.id, brandId: brand.id, alias, normalizedAlias: alias.trim().toLowerCase() },
        update: { brandId: brand.id, alias, isActive: true },
      });
    }
    const categoryIds: Record<string, string> = {};
    for (const [slug, label] of Object.entries(CATEGORY_LABELS)) {
      const category = await tx.shopCategory.upsert({
        where: { slug },
        create: { slug, titleUa: label.ua, titleEn: label.en, isPublished: true },
        update: { titleUa: label.ua, titleEn: label.en },
      });
      categoryIds[slug] = category.id;
    }
    return { sourceId: source.id, brandId: brand.id, categoryIds };
  });
}

export async function insertKwDraftWithClient(input: {
  client: PrismaClient;
  draft: KwCanonicalProductDraft;
  rawProduct: ShopifySnapshotProduct;
  dependencies: Awaited<ReturnType<typeof ensureKwImportDependencies>>;
}) {
  const { client, draft, rawProduct, dependencies } = input;
  return client.$transaction(async (tx) => {
    const existing = await tx.shopCatalogSourceBindingHead.findUnique({
      where: { sourceId_entityType_externalKey: { sourceId: dependencies.sourceId, entityType: "PRODUCT", externalKey: draft.source.externalProductId } },
      select: { currentBinding: { select: { productId: true } } },
    });
    if (existing?.currentBinding.productId) return { status: "idempotent" as const, productId: existing.currentBinding.productId };
    const categoryId = dependencies.categoryIds[draft.product.productCategory];
    if (!categoryId) throw new Error(`Missing KW category ${draft.product.productCategory}`);
    const product = await tx.shopProduct.create({
      data: {
        ...draft.product,
        brandId: dependencies.brandId,
        categoryId,
        gallery: draft.media.map((media) => media.src),
        publishedAt: null,
        variants: { create: draft.variants.map((variant) => ({
          title: variant.title, sku: variant.sku, barcode: variant.barcode, position: variant.position,
          option1Value: variant.optionValues[0] ?? null, option2Value: variant.optionValues[1] ?? null, option3Value: variant.optionValues[2] ?? null,
          inventoryQty: variant.inventoryQty, inventoryPolicy: variant.inventoryPolicy,
          priceUah: variant.priceUah, compareAtUah: variant.compareAtUah, isDefault: variant.isDefault,
        })) },
        media: { create: draft.media.map((media) => ({ mediaType: media.mediaType === "VIDEO" ? "VIDEO" : media.mediaType === "EXTERNAL_VIDEO" ? "EXTERNAL_VIDEO" : "IMAGE", src: media.src, altText: media.altText, position: media.position })) },
        options: { create: draft.options.map((option) => ({ name: option.name, position: option.position, values: option.values })) },
        metafields: { create: draft.metafields.map((field) => ({ namespace: field.namespace, key: field.key, value: field.value, valueType: field.valueType })) },
      },
      select: { id: true, variants: { select: { id: true, position: true }, orderBy: { position: "asc" } } },
    });
    const sourceRecord = await tx.shopCatalogSourceRecord.create({
      data: {
        sourceId: dependencies.sourceId, recordKey: draft.source.externalProductId, sourceRevision: draft.source.revision,
        rawPayload: jsonValue(rawProduct), payloadHash: draft.source.payloadHash, productId: product.id,
        sourceUpdatedAt: dateValue(rawProduct.updatedAt),
      },
    });
    const productBinding = await tx.shopCatalogSourceBinding.create({
      data: {
        sourceId: dependencies.sourceId, sourceRecordId: sourceRecord.id, entityType: "PRODUCT",
        externalKey: draft.source.externalProductId, canonicalEntityId: product.id, productId: product.id,
        decisionReason: "exact Shopify product GID from approved KW-only source", reviewedById: "codex:kw-import",
      },
    });
    await tx.shopCatalogSourceBindingHead.create({
      data: { sourceId: dependencies.sourceId, entityType: "PRODUCT", externalKey: draft.source.externalProductId, currentBindingId: productBinding.id },
    });
    for (let index = 0; index < draft.variants.length; index += 1) {
      const local = product.variants[index];
      const external = draft.variants[index];
      if (!local || !external) throw new Error(`KW variant ownership mismatch for ${draft.source.externalProductId}`);
      const binding = await tx.shopCatalogSourceBinding.create({
        data: {
          sourceId: dependencies.sourceId, sourceRecordId: sourceRecord.id, entityType: "VARIANT",
          externalKey: external.externalVariantId, canonicalEntityId: local.id, productId: product.id, variantId: local.id,
          decisionReason: "exact Shopify variant GID and stable position", reviewedById: "codex:kw-import",
        },
      });
      await tx.shopCatalogSourceBindingHead.create({
        data: { sourceId: dependencies.sourceId, entityType: "VARIANT", externalKey: external.externalVariantId, currentBindingId: binding.id },
      });
    }
    const leaves = flattenShopCatalogRawPayload(rawProduct);
    if (leaves.length) await tx.shopCatalogFieldProvenance.createMany({ data: leaves.map((leaf) => ({
      sourceRecordId: sourceRecord.id, fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: jsonValue(leaf.value),
      canonicalEntityType: leaf.fieldPath.startsWith("variants.") ? "VARIANT" : "PRODUCT",
      canonicalEntityId: leaf.fieldPath.startsWith("variants.") ? product.variants[leaf.ordinal]?.id ?? product.id : product.id,
      canonicalField: leaf.fieldPath, normalizedValue: jsonValue(leaf.value), mappingStatus: "MAPPED",
      mapperVersion: "kw-shopify-v1", confidence: 1, productId: product.id,
      variantId: leaf.fieldPath.startsWith("variants.") ? product.variants[leaf.ordinal]?.id ?? null : null,
    })) });
    if (draft.issues.length) await tx.shopCatalogNormalizationIssue.createMany({ data: draft.issues.map((issue) => ({
      sourceRecordId: sourceRecord.id, productId: product.id, issueKey: `kw:${issue}`, code: issue.toUpperCase(), rawPath: "$",
      details: { externalProductId: draft.source.externalProductId, sku: draft.product.sku } as Prisma.InputJsonValue,
    })) });
    return { status: "inserted" as const, productId: product.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
}
