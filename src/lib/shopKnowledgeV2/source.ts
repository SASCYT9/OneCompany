import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { KnowledgeSourceProduct } from "@/lib/shopKnowledgeV2/types";

export const shopKnowledgeSourceSelect = Prisma.validator<Prisma.ShopProductSelect>()({
  id: true,
  slug: true,
  sku: true,
  scope: true,
  brand: true,
  vendor: true,
  productType: true,
  productCategory: true,
  titleUa: true,
  titleEn: true,
  categoryUa: true,
  categoryEn: true,
  shortDescUa: true,
  shortDescEn: true,
  longDescUa: true,
  longDescEn: true,
  leadTimeUa: true,
  leadTimeEn: true,
  collectionUa: true,
  collectionEn: true,
  bodyHtmlUa: true,
  bodyHtmlEn: true,
  seoTitleUa: true,
  seoTitleEn: true,
  seoDescriptionUa: true,
  seoDescriptionEn: true,
  tags: true,
  highlights: true,
  isPublished: true,
  status: true,
  updatedAt: true,
  variants: {
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      sku: true,
      position: true,
      option1Value: true,
      option2Value: true,
      option3Value: true,
      inventoryQty: true,
      updatedAt: true,
    },
  },
  options: {
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      position: true,
      values: true,
      updatedAt: true,
    },
  },
  metafields: {
    orderBy: [{ namespace: "asc" }, { key: "asc" }],
    select: {
      id: true,
      namespace: true,
      key: true,
      value: true,
      valueType: true,
      updatedAt: true,
    },
  },
  knowledge: {
    select: {
      status: true,
      qualityFlags: true,
      vehicleApplications: {
        where: {
          isActive: true,
          source: "MANAGER",
          verificationStatus: { in: ["VERIFIED", "NEEDS_REVIEW"] },
          evidence: {
            some: {
              isActive: true,
              source: "MANAGER",
              fieldPath: { startsWith: "vehicleApplications." },
              extractorVersion: { startsWith: "admin-" },
            },
          },
        },
        orderBy: [{ verifiedAt: "desc" }, { updatedAt: "desc" }],
        select: {
          applicationKey: true,
          variantId: true,
          scope: true,
          make: true,
          model: true,
          generation: true,
          chassisCode: true,
          yearFrom: true,
          yearTo: true,
          engine: true,
          fuel: true,
          bodyStyle: true,
          drivetrain: true,
          transmission: true,
          market: true,
          opfGpf: true,
          categoryGroup: true,
          productKind: true,
          material: true,
          isUniversal: true,
          verificationStatus: true,
          confidence: true,
          verifiedById: true,
          verifiedAt: true,
          updatedAt: true,
          evidence: {
            where: {
              isActive: true,
              source: "MANAGER",
              fieldPath: { startsWith: "vehicleApplications." },
              extractorVersion: { startsWith: "admin-" },
            },
            orderBy: [{ isManagerVerified: "desc" }, { verifiedAt: "desc" }, { updatedAt: "desc" }],
            select: {
              evidenceKey: true,
              fieldPath: true,
              sourceRef: true,
              excerpt: true,
              sourceHash: true,
              confidence: true,
              extractorVersion: true,
              isManagerVerified: true,
              verifiedById: true,
              verifiedAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
});

export type ShopKnowledgeSourceRow = Prisma.ShopProductGetPayload<{
  select: typeof shopKnowledgeSourceSelect;
}>;

export function mapShopKnowledgeSourceProduct(row: ShopKnowledgeSourceRow): KnowledgeSourceProduct {
  const { knowledge, ...product } = row;
  return {
    ...product,
    status: product.status,
    managerApplications: (knowledge?.vehicleApplications ?? [])
      .filter((application) =>
        application.evidence.some(
          (evidence) =>
            evidence.fieldPath.startsWith("vehicleApplications.") &&
            evidence.extractorVersion?.startsWith("admin-") === true
        )
      )
      .map((application) => ({
        ...application,
        verificationStatus:
          application.verificationStatus === "VERIFIED" ? "VERIFIED" : "NEEDS_REVIEW",
      })),
    managerStrictBlock: Boolean(knowledge?.qualityFlags.includes("blocked_strict:manager")),
  };
}

export async function getShopKnowledgeSourceProduct(
  productId: string
): Promise<KnowledgeSourceProduct | null> {
  const row = await prisma.shopProduct.findUnique({
    where: { id: productId },
    select: shopKnowledgeSourceSelect,
  });
  return row ? mapShopKnowledgeSourceProduct(row) : null;
}

export type ListShopKnowledgeSourceProductsOptions = {
  cursor?: string;
  take: number;
  includeBlocked?: boolean;
};

export async function listShopKnowledgeSourceProducts(
  options: ListShopKnowledgeSourceProductsOptions
): Promise<KnowledgeSourceProduct[]> {
  const rows = await prisma.shopProduct.findMany({
    where: options.includeBlocked
      ? undefined
      : {
          isPublished: true,
          status: "ACTIVE",
        },
    orderBy: { id: "asc" },
    take: options.take,
    ...(options.cursor
      ? {
          cursor: { id: options.cursor },
          skip: 1,
        }
      : {}),
    select: shopKnowledgeSourceSelect,
  });
  return rows.map(mapShopKnowledgeSourceProduct);
}
