import "server-only";
import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  buildFiCanonicalDraft,
  type FiCanonicalDraft,
  type FiSourceProduct,
  type FiFitmentEntry,
} from "./shopCatalogFiDraft";
import { buildFiPolicyEvidence } from "./shopCatalogFiPolicyEvidence";
import { buildShopCatalogImportProvenance } from "./shopCatalogImportProvenance";
import {
  acquireCatalogCanonicalLocks,
  catalogSourceBindingLockKey,
} from "./shopCatalogCanonicalLocks.server";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function ensureFiImportDependencies(client: PrismaClient) {
  return client.$transaction(async (tx) => {
    const source = await tx.shopCatalogSource.upsert({
      where: { key: "shopify-fi-exhaust" },
      create: {
        key: "shopify-fi-exhaust",
        displayName: "Fi EXHAUST Shopify",
        kind: "INTEGRATION",
        priority: 40,
      },
      update: { displayName: "Fi EXHAUST Shopify", kind: "INTEGRATION", isActive: true },
    });
    const brand = await tx.shopBrand.upsert({
      where: { key: "fi-exhaust" },
      create: { key: "fi-exhaust", name: "Fi EXHAUST", nameUa: "Fi EXHAUST", nameEn: "Fi EXHAUST" },
      update: { name: "Fi EXHAUST", nameUa: "Fi EXHAUST", nameEn: "Fi EXHAUST", isActive: true },
    });
    for (const alias of ["Fi Exhaust", "FI EXHAUST", "Fi EXHAUST"]) {
      await tx.shopBrandAlias.upsert({
        where: {
          sourceId_normalizedAlias: { sourceId: source.id, normalizedAlias: alias.toLowerCase() },
        },
        create: {
          sourceId: source.id,
          brandId: brand.id,
          alias,
          normalizedAlias: alias.toLowerCase(),
        },
        update: { brandId: brand.id, alias, isActive: true },
      });
    }
    const category = await tx.shopCategory.upsert({
      where: { slug: "exhaust-systems" },
      create: {
        slug: "exhaust-systems",
        titleUa: "Вихлопні системи",
        titleEn: "Exhaust systems",
        isPublished: true,
      },
      update: { titleUa: "Вихлопні системи", titleEn: "Exhaust systems" },
    });
    return { sourceId: source.id, brandId: brand.id, categoryId: category.id };
  });
}

export async function insertFiDraftWithClient(input: {
  client: PrismaClient;
  draft: FiCanonicalDraft;
  rawProduct: FiSourceProduct;
  fitment: FiFitmentEntry;
  dependencies: Awaited<ReturnType<typeof ensureFiImportDependencies>>;
}) {
  const { client, draft, rawProduct, dependencies } = input;
  if (
    draft.source.payloadHash !==
      createHash("sha256").update(JSON.stringify(rawProduct)).digest("hex") ||
    draft.source.revision !== rawProduct.updated_at
  )
    throw new Error("FI draft source is stale; rebuild the draft");
  const evidence = buildFiPolicyEvidence({
    product: rawProduct,
    fitment: input.fitment,
  }).sourceRecord;
  const normalizedField = (value: FiCanonicalDraft) =>
    value.metafields.find(
      (field) => field.namespace === "onecompany" && field.key === "normalized_fitment"
    )?.value;
  if (
    draft.source.externalProductId !== evidence.recordKey ||
    normalizedField(draft) !== normalizedField(buildFiCanonicalDraft(rawProduct, input.fitment))
  ) {
    throw new Error("FI draft and source fitment evidence disagree; rebuild the draft");
  }
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
            "FI source evidence changed or predates policy evidence; use a reviewed source revision promotion"
          );
        return { status: "idempotent" as const, productId: existing.currentBinding.productId };
      }
      const product = await tx.shopProduct.create({
        data: {
          ...draft.product,
          brandId: dependencies.brandId,
          categoryId: dependencies.categoryId,
          gallery: draft.media
            .filter((media) => media.mediaType === "IMAGE")
            .map((media) => media.src),
          publishedAt: null,
          variants: {
            create: draft.variants.map((variant) => ({
              title: variant.title,
              sku: variant.sku,
              barcode: variant.barcode,
              position: variant.position,
              inventoryQty: variant.inventoryQty,
              inventoryPolicy: variant.inventoryPolicy,
              priceUah: variant.priceUah,
              compareAtUah: variant.compareAtUah,
              isDefault: variant.isDefault,
            })),
          },
          media: {
            create: draft.media.map((media) => ({
              mediaType: media.mediaType,
              src: media.src,
              altText: media.altText,
              position: media.position,
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
          sourceUpdatedAt: new Date(rawProduct.updated_at),
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
          decisionReason: "exact Shopify product ID from approved Fi EXHAUST source",
          reviewedById: "codex:fi-import",
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
          throw new Error(`Fi variant ownership mismatch for ${draft.source.externalProductId}`);
        const binding = await tx.shopCatalogSourceBinding.create({
          data: {
            sourceId: dependencies.sourceId,
            sourceRecordId: sourceRecord.id,
            entityType: "VARIANT",
            externalKey: external.externalVariantId,
            canonicalEntityId: local.id,
            productId: product.id,
            variantId: local.id,
            decisionReason: "exact Shopify variant ID",
            reviewedById: "codex:fi-import",
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
            issueKey: `fi:${issue}`,
            code: issue.toUpperCase(),
            rawPath: "$",
            details: {
              externalProductId: draft.source.externalProductId,
              sku: draft.product.sku,
            } as Prisma.InputJsonValue,
          })),
        });
      return { status: "inserted" as const, productId: product.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 }
  );
}
