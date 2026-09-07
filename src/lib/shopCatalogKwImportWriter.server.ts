import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { hashKwSourceProduct, type KwCanonicalProductDraft } from "./shopCatalogKwDraft";
import type { ShopifySnapshotProduct } from "./shopifyCatalogSnapshot";
import { buildKwPolicyEvidence } from "./shopCatalogKwPolicyEvidence";
import { buildKwCompatibilityPolicy, buildKwNormalizedFitment } from "./shopCatalogKwNormalization";
import { persistCanonicalPolicyInTransaction } from "./shopCatalogCanonicalPolicyPersistence.server";
import { buildShopCatalogImportProvenance } from "./shopCatalogImportProvenance";
import {
  acquireCatalogCanonicalLocks,
  catalogSourceBindingLockKey,
} from "./shopCatalogCanonicalLocks.server";

const CATEGORY_LABELS: Readonly<Record<string, { ua: string; en: string }>> = {
  coilovers: { ua: "Койловерна підвіска", en: "Coilovers" },
  "springs-and-sport-suspension": {
    ua: "Пружини та спортивна підвіска",
    en: "Springs and sport suspension",
  },
  "hydraulic-lift-system": {
    ua: "Гідравлічна система підйому підвіски",
    en: "Hydraulic lift systems",
  },
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
      create: {
        key: "shopify-kw-suspensions",
        displayName: "KW Suspensions Shopify",
        kind: "INTEGRATION",
        priority: 40,
      },
      update: { displayName: "KW Suspensions Shopify", kind: "INTEGRATION", isActive: true },
    });
    const brand = await tx.shopBrand.upsert({
      where: { key: "kw-suspensions" },
      create: {
        key: "kw-suspensions",
        name: "KW Suspensions",
        nameUa: "KW Suspensions",
        nameEn: "KW Suspensions",
      },
      update: { name: "KW Suspensions", isActive: true },
    });
    for (const alias of ["KW", "KW Automotive Ukraine", "KW Suspensions"]) {
      await tx.shopBrandAlias.upsert({
        where: {
          sourceId_normalizedAlias: {
            sourceId: source.id,
            normalizedAlias: alias.trim().toLowerCase(),
          },
        },
        create: {
          sourceId: source.id,
          brandId: brand.id,
          alias,
          normalizedAlias: alias.trim().toLowerCase(),
        },
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
  if (
    draft.source.payloadHash !== hashKwSourceProduct(rawProduct) ||
    draft.source.revision !==
      (typeof rawProduct.updatedAt === "string" && rawProduct.updatedAt.trim()
        ? rawProduct.updatedAt.trim()
        : "unknown")
  )
    throw new Error("KW draft source is stale; rebuild the draft");
  const evidence = buildKwPolicyEvidence({
    product: rawProduct,
    normalization: draft.normalization,
    productId: draft.source.externalProductId,
  }).sourceRecord;
  if (draft.source.externalProductId !== evidence.recordKey)
    throw new Error("KW draft and source evidence identity mismatch");
  if (
    draft.metafields.find(
      (field) => field.namespace === "onecompany" && field.key === "normalized_fitment"
    )?.value !== JSON.stringify(buildKwNormalizedFitment(draft.normalization))
  )
    throw new Error("KW draft and source fitment evidence disagree; rebuild the draft");
  return client.$transaction(
    async (tx) => {
      await acquireCatalogCanonicalLocks(tx, [
        catalogSourceBindingLockKey({
          sourceId: dependencies.sourceId,
          entityType: "PRODUCT",
          externalKey: draft.source.externalProductId,
        }),
      ]);
      const existing = await tx.shopCatalogSourceBindingHead.findUnique({
        where: {
          sourceId_entityType_externalKey: {
            sourceId: dependencies.sourceId,
            entityType: "PRODUCT",
            externalKey: draft.source.externalProductId,
          },
        },
        select: {
          currentBinding: {
            select: {
              productId: true,
              sourceRecord: { select: { payloadHash: true, sourceRevision: true } },
            },
          },
        },
      });
      if (existing?.currentBinding.productId) {
        const previous = existing.currentBinding.sourceRecord;
        if (
          previous?.payloadHash !== evidence.payloadHash ||
          previous.sourceRevision !== evidence.sourceRevision
        )
          throw new Error(
            "KW source evidence changed or predates policy evidence; use a reviewed source revision promotion"
          );
        return { status: "idempotent" as const, productId: existing.currentBinding.productId };
      }
      const categoryId = dependencies.categoryIds[draft.product.productCategory];
      if (!categoryId) throw new Error(`Missing KW category ${draft.product.productCategory}`);
      const product = await tx.shopProduct.create({
        data: {
          ...draft.product,
          brandId: dependencies.brandId,
          categoryId,
          gallery: draft.media.map((media) => media.src),
          publishedAt: null,
          variants: {
            create: draft.variants.map((variant) => ({
              title: variant.title,
              sku: variant.sku,
              barcode: variant.barcode,
              position: variant.position,
              option1Value: variant.optionValues[0] ?? null,
              option2Value: variant.optionValues[1] ?? null,
              option3Value: variant.optionValues[2] ?? null,
              inventoryQty: variant.inventoryQty,
              inventoryPolicy: variant.inventoryPolicy,
              priceUah: variant.priceUah,
              compareAtUah: variant.compareAtUah,
              isDefault: variant.isDefault,
            })),
          },
          media: {
            create: draft.media.map((media) => ({
              mediaType:
                media.mediaType === "VIDEO"
                  ? "VIDEO"
                  : media.mediaType === "EXTERNAL_VIDEO"
                    ? "EXTERNAL_VIDEO"
                    : "IMAGE",
              src: media.src,
              altText: media.altText,
              position: media.position,
            })),
          },
          options: {
            create: draft.options.map((option) => ({
              name: option.name,
              position: option.position,
              values: option.values,
            })),
          },
          metafields: {
            create: draft.metafields.map((field) => ({
              namespace: field.namespace,
              key: field.key,
              value: field.value,
              valueType: field.valueType,
            })),
          },
        },
        select: {
          id: true,
          variants: { select: { id: true, position: true }, orderBy: { position: "asc" } },
        },
      });
      const sourceRecord = await tx.shopCatalogSourceRecord.create({
        data: {
          sourceId: dependencies.sourceId,
          recordKey: evidence.recordKey,
          sourceRevision: evidence.sourceRevision,
          rawPayload: jsonValue(evidence.rawPayload),
          payloadHash: evidence.payloadHash,
          productId: product.id,
          sourceUpdatedAt: dateValue(rawProduct.updatedAt),
        },
      });
      const productBinding = await tx.shopCatalogSourceBinding.create({
        data: {
          sourceId: dependencies.sourceId,
          sourceRecordId: sourceRecord.id,
          entityType: "PRODUCT",
          externalKey: draft.source.externalProductId,
          canonicalEntityId: product.id,
          productId: product.id,
          decisionReason: "exact Shopify product GID from approved KW-only source",
          reviewedById: "codex:kw-import",
        },
      });
      await tx.shopCatalogSourceBindingHead.create({
        data: {
          sourceId: dependencies.sourceId,
          entityType: "PRODUCT",
          externalKey: draft.source.externalProductId,
          currentBindingId: productBinding.id,
        },
      });
      for (let index = 0; index < draft.variants.length; index += 1) {
        const local = product.variants[index];
        const external = draft.variants[index];
        if (!local || !external)
          throw new Error(`KW variant ownership mismatch for ${draft.source.externalProductId}`);
        const binding = await tx.shopCatalogSourceBinding.create({
          data: {
            sourceId: dependencies.sourceId,
            sourceRecordId: sourceRecord.id,
            entityType: "VARIANT",
            externalKey: external.externalVariantId,
            canonicalEntityId: local.id,
            productId: product.id,
            variantId: local.id,
            decisionReason: "exact Shopify variant GID and stable position",
            reviewedById: "codex:kw-import",
          },
        });
        await tx.shopCatalogSourceBindingHead.create({
          data: {
            sourceId: dependencies.sourceId,
            entityType: "VARIANT",
            externalKey: external.externalVariantId,
            currentBindingId: binding.id,
          },
        });
      }
      const provenance = buildShopCatalogImportProvenance({
        rawPayload: evidence.rawPayload,
        productId: product.id,
        sourceRecordId: sourceRecord.id,
        mapperVersion: evidence.rawPayload.mapperVersion,
        variantIds: new Map(
          draft.variants.map((variant, index) => [
            variant.externalVariantId,
            product.variants[index]!.id,
          ])
        ),
      });
      if (provenance.length)
        await tx.shopCatalogFieldProvenance.createMany({
          data: provenance.map((row) => ({
            ...row,
            rawValue: jsonValue(row.rawValue),
            normalizedValue: jsonValue(row.normalizedValue),
          })),
        });
      if (draft.issues.length)
        await tx.shopCatalogNormalizationIssue.createMany({
          data: draft.issues.map((issue) => ({
            sourceRecordId: sourceRecord.id,
            productId: product.id,
            issueKey: `kw:${issue}`,
            code: issue.toUpperCase(),
            rawPath: "$",
            details: {
              externalProductId: draft.source.externalProductId,
              sku: draft.product.sku,
            } as Prisma.InputJsonValue,
          })),
        });
      // Persist the V2 policy from the complete source evidence in this same
      // transaction. Unknown make and multi-chassis clauses are represented by
      // UNKNOWN/text values and retain their INFERRED/NEEDS_REVIEW status; the
      // lossless validator rejects any accidental exact null or raw VERIFIED
      // engine before a row can become active.
      await persistCanonicalPolicyInTransaction({
        tx,
        sourceId: dependencies.sourceId,
        sourceRecordId: sourceRecord.id,
        policy: buildKwCompatibilityPolicy(product.id, draft.normalization),
        label: "KW",
      });
      return { status: "inserted" as const, productId: product.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }
  );
}
