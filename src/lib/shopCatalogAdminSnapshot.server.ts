import type { Prisma } from "@prisma/client";

import { adminProductInclude } from "./shopAdminCatalog";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  parseNormalizedFitment,
  type NormalizedFitment,
  type VehicleApplication,
} from "./shopFitmentQuality";
import type { ShopCatalogCoordinatedMutationSnapshot } from "./shopCatalogMutationCoordinator.server";
import type { ShopCatalogProjectionSource } from "./shopCatalogProjection.server";
import type {
  ShopCatalogV2CompatibilityClause,
  ShopCatalogV2CompatibilityConstraint,
  ShopCatalogV2CompatibilityPolicy,
} from "./shopCatalogV2Compatibility";

type AdminProductRecord = Prisma.ShopProductGetPayload<{ include: typeof adminProductInclude }>;

function exact(dimension: string, values: readonly unknown[]) {
  const cleaned = [...new Set(values.filter((value) => value !== null && value !== ""))];
  return cleaned.length
    ? ({ dimension, state: "EXACT", values: cleaned } as ShopCatalogV2CompatibilityConstraint)
    : null;
}

function applicationClause(
  application: VehicleApplication,
  index: number,
  verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW"
): ShopCatalogV2CompatibilityClause {
  const constraints = [
    exact("scope", [application.vehicleType === "motorcycle" ? "moto" : "auto"]),
    exact("make", [application.make]),
    exact("model", application.models),
    exact("generation", application.chassisCodes),
    exact("chassis", application.chassisCodes),
    exact("year", application.yearRanges),
    exact("engine", application.engines),
    exact("fuel", application.fuel ? [application.fuel] : []),
    exact("bodyStyle", application.bodyStyles),
    exact("drivetrain", application.drivetrains),
    exact("transmission", application.transmission ? [application.transmission] : []),
    exact("market", application.markets),
    exact("opfGpf", application.opfGpf && application.opfGpf !== "unknown" ? [application.opfGpf] : []),
  ].filter((constraint): constraint is ShopCatalogV2CompatibilityConstraint => Boolean(constraint));
  return {
    id: `normalized-fitment-${index + 1}`,
    constraints,
    verification,
    sourceRef: `metafield:${NORMALIZED_FITMENT_NAMESPACE}.${NORMALIZED_FITMENT_KEY}`,
  };
}

export function compatibilityPolicyFromNormalizedFitment(
  productId: string,
  fitment: NormalizedFitment | null
): ShopCatalogV2CompatibilityPolicy {
  if (fitment?.status === "universal") {
    return {
      version: 2,
      mode: "UNIVERSAL",
      target: { productId },
      requiredDimensions: [],
      clauses: [],
    };
  }
  const verification =
    fitment?.status === "verified"
      ? "VERIFIED"
      : fitment?.status === "inferred"
        ? "INFERRED"
        : "NEEDS_REVIEW";
  const clauses = (fitment?.applications ?? []).map((application, index) =>
    applicationClause(application, index, verification)
  );
  return {
    version: 2,
    mode: clauses.length && verification !== "NEEDS_REVIEW" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
    target: { productId },
    requiredDimensions: clauses.length ? ["make", "model"] : [],
    clauses,
  };
}

function jsonSnapshot(record: unknown): unknown {
  return JSON.parse(
    JSON.stringify(record, (_key, value) => (typeof value === "bigint" ? value.toString() : value))
  );
}

async function loadLosslessCanonicalProduct(tx: Prisma.TransactionClient, productId: string) {
  const product = await tx.shopProduct.findUnique({
    where: { id: productId },
    include: {
      category: true,
      bundle: { include: { items: true } },
      bundleComponentItems: true,
      cartItems: { select: { id: true, productId: true, variantId: true, productSlug: true } },
      orderItems: { select: { id: true, productId: true, variantId: true, productSlug: true } },
      collections: { include: { collection: true } },
      media: true,
      options: true,
      metafields: true,
      variants: {
        include: {
          inventoryLevels: true,
          cartItems: {
            where: { productId: null },
            select: { id: true, productId: true, variantId: true, productSlug: true },
          },
          knowledgeReviewTasks: true,
        },
      },
      vehicleApplications: { include: { reviewTasks: true } },
      knowledgeAttributeValues: { include: { definition: true, reviewTasks: true } },
      knowledgeChunks: true,
      knowledgeEvidence: true,
      knowledgeRevisions: true,
      knowledgeReviewTasks: true,
      knowledgeOutboxEvents: true,
      variantKnowledge: {
        include: {
          applications: true,
          attributeValues: { include: { definition: true } },
          chunks: true,
          evidence: true,
        },
      },
      knowledge: { include: { reviewTasks: true } },
    },
  });
  if (!product) throw new Error(`Cannot snapshot missing product ${productId}`);
  const variantOrderItems = product.variants.length
    ? await tx.shopOrderItem.findMany({
        where: { productId: null, variantId: { in: product.variants.map((variant) => variant.id) } },
        select: { id: true, productId: true, variantId: true, productSlug: true },
      })
    : [];
  return { product, variantOrderItems };
}

function projectionSource(
  record: AdminProductRecord,
  nextCatalogVersion: string,
  inventoryLevelCount: number
): ShopCatalogProjectionSource {
  const normalizedMetafield = record.metafields.find(
    (item) =>
      item.namespace === NORMALIZED_FITMENT_NAMESPACE && item.key === NORMALIZED_FITMENT_KEY
  );
  const normalizedFitment = parseNormalizedFitment(normalizedMetafield?.value);
  const primaryMedia = record.media[0];
  return {
    productId: record.id,
    sourceVersion: nextCatalogVersion,
    catalogVersion: nextCatalogVersion,
    sourceUpdatedAt: record.updatedAt,
    canonicalContentHash: "0".repeat(64),
    canonicalRelationCounts: {
      variants: record.variants.length,
      media: record.media.length,
      options: record.options.length,
      metafields: record.metafields.length,
      collections: record.collections.length,
      applications: normalizedFitment?.applications.length ?? 0,
      bundleItems: record.bundle?.items.length ?? 0,
      inventoryLevels: inventoryLevelCount,
    },
    slug: record.slug,
    sku: record.sku,
    scopeKey: record.scope,
    statusKey: record.status,
    stockKey: record.stock,
    isPublished: record.isPublished,
    stableRank: 0,
    brand: {
      id: record.brandId,
      key: record.brand ?? record.vendor ?? "unbranded",
      labelUa: record.brand ?? record.vendor ?? "Без бренду",
      labelEn: record.brand ?? record.vendor ?? "Unbranded",
    },
    category: record.category
      ? {
          id: record.category.id,
          key: record.category.slug,
          labelUa: record.category.titleUa,
          labelEn: record.category.titleEn,
        }
      : null,
    productTypeKey: record.productType,
    productKindKey: record.productCategory,
    categoryGroupKey: record.category?.slug ?? null,
    locales: {
      ua: {
        title: record.titleUa,
        cardCopy: record.shortDescUa,
        searchTerms: [record.sku, record.brand, record.vendor, ...record.tags].filter(
          (value): value is string => Boolean(value)
        ),
      },
      en: {
        title: record.titleEn,
        cardCopy: record.shortDescEn,
        searchTerms: [record.sku, record.brand, record.vendor, ...record.tags].filter(
          (value): value is string => Boolean(value)
        ),
      },
    },
    primaryMedia: primaryMedia
      ? { assetId: primaryMedia.id, url: primaryMedia.src }
      : record.image
        ? { url: record.image }
        : null,
    tags: record.tags,
    collectionKeys: record.collections.map((item) => item.collection.handle),
    sharedSearchTerms: record.variants
      .flatMap((variant) => [variant.sku, variant.barcode])
      .filter((value): value is string => Boolean(value)),
    variants: record.variants.map((variant, index) => ({
      variantId: variant.id,
      sku: variant.sku,
      isDefault: variant.isDefault,
      stableRank: variant.position || index + 1,
    })),
    compatibilityPolicies: [compatibilityPolicyFromNormalizedFitment(record.id, normalizedFitment)],
  };
}

export async function buildShopCatalogAdminSnapshot(
  tx: Prisma.TransactionClient,
  productId: string,
  nextCatalogVersion: string,
  actor: { type: string; id?: string | null; reason?: string | null }
): Promise<ShopCatalogCoordinatedMutationSnapshot> {
  const record = await tx.shopProduct.findUnique({
    where: { id: productId },
    include: adminProductInclude,
  });
  if (!record) throw new Error(`Cannot snapshot missing product ${productId}`);
  const canonical = await loadLosslessCanonicalProduct(tx, productId);
  return {
    canonical: jsonSnapshot(canonical),
    projectionSource: projectionSource(
      record,
      nextCatalogVersion,
      canonical.product.variants.reduce((count, variant) => count + variant.inventoryLevels.length, 0)
    ),
    actorType: actor.type,
    actorId: actor.id ?? null,
    reason: actor.reason ?? null,
  };
}
