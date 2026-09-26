import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminProductInclude,
  adminProductListSelect,
  buildAutomaticFitmentFromAdminPayload,
  buildAdminProductCreateData,
  normalizeAdminProductPayload,
  serializeAdminProductListItem,
  shouldPersistAutomaticFitment,
} from "@/lib/shopAdminCatalog";
import { prisma } from "@/lib/prisma";
import { getShopInStockProducts } from "@/lib/shopWarehouseInventory.server";
import { revalidateShopStorefrontProduct } from "@/lib/shopStorefrontRevalidation";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductCreation } from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import {
  SHOP_PRODUCT_ADMIN_MEDIA_KEY,
  SHOP_PRODUCT_ADMIN_MEDIA_NAMESPACE,
} from "@/lib/shopProductAdminMedia";
import { tokenizeShopSearchQuery } from "@/lib/shopSearch";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  normalizeManualFitment,
} from "@/lib/shopFitmentQuality";

import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "ALL";
    const status = searchParams.get("status")?.trim() || "ALL";
    const stock = searchParams.get("stock")?.trim() || "ALL";

    const baseWhere: Prisma.ShopProductWhereInput = {};
    const confirmed =
      searchParams.get("availability") === "confirmed" ? await getShopInStockProducts() : null;
    if (confirmed) baseWhere.id = { in: confirmed.map((product) => product.id) };

    if (stock !== "ALL" && !["inStock", "outOfStock", "preOrder", "inTransit"].includes(stock)) {
      return NextResponse.json({ error: "Invalid stock filter" }, { status: 400 });
    }
    if (stock !== "ALL") baseWhere.stock = stock;

    if (status !== "ALL") {
      // @ts-expect-error type checking against the Prisma schema status
      baseWhere.status = status;
    }

    const searchFields = (value: string): Prisma.ShopProductWhereInput[] => [
      { slug: { contains: value, mode: "insensitive" } },
      { titleEn: { contains: value, mode: "insensitive" } },
      { titleUa: { contains: value, mode: "insensitive" } },
      { brand: { contains: value, mode: "insensitive" } },
      { vendor: { contains: value, mode: "insensitive" } },
      { sku: { contains: value, mode: "insensitive" } },
      { variants: { some: { sku: { contains: value, mode: "insensitive" } } } },
    ];
    const tokens = tokenizeShopSearchQuery(search);
    // Match every meaningful token across the searchable product fields.
    // This handles "Widetrack Urban", mixed-language queries and SKUs with
    // separators without requiring the exact stored word order.
    const searchWhere: Prisma.ShopProductWhereInput = search
      ? {
          AND: tokens.length
            ? tokens.map((token) => ({ OR: searchFields(token) }))
            : [{ OR: searchFields(search) }],
        }
      : {};
    const where: Prisma.ShopProductWhereInput = {
      ...baseWhere,
      ...searchWhere,
      ...(brand !== "ALL" ? { brand: { equals: brand, mode: "insensitive" } } : {}),
    };
    const brandWhere: Prisma.ShopProductWhereInput = { ...baseWhere, ...searchWhere };

    const skip = (page - 1) * limit;

    const [totalCount, products, brandGroups] = await prisma.$transaction([
      prisma.shopProduct.count({ where }),
      prisma.shopProduct.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        select: adminProductListSelect,
      }),
      prisma.shopProduct.groupBy({
        by: ["brand"],
        where: brandWhere,
        orderBy: { _count: { brand: "desc" } },
        _count: { brand: true },
      }),
    ]);

    // Catalog V2 stores the storefront's canonical primary image. Use it for
    // admin cards when available so managers see the same photo as buyers,
    // while retaining legacy product/media URLs as fallbacks.
    const projectionImages = await prisma.shopCatalogProjection.findMany({
      where: {
        locale: "ua",
        productId: { in: products.map((product) => product.id) },
      },
      select: { productId: true, primaryMediaUrl: true },
    });
    const canonicalImageByProductId = new Map(
      projectionImages
        .filter((entry) => entry.primaryMediaUrl?.trim())
        .map((entry) => [entry.productId, entry.primaryMediaUrl!.trim()])
    );

    return NextResponse.json({
      products: products.map((product) => {
        const result = serializeAdminProductListItem(product);
        const canonicalImage = canonicalImageByProductId.get(product.id);
        const imageSources = canonicalImage
          ? [canonicalImage, ...result.imageSources.filter((source) => source !== canonicalImage)]
          : result.imageSources;
        const availability = confirmed?.find((entry) => entry.id === product.id);
        return {
          ...result,
          ...(canonicalImage ? { imageUrl: canonicalImage, imageSources } : {}),
          ...(availability ? { stock: "inStock", sku: availability.sku ?? result.sku } : {}),
        };
      }),
      metadata: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
        brands: brandGroups
          .filter((entry) => entry.brand?.trim())
          .map((entry) => ({
            brand: entry.brand!.trim(),
            count: typeof entry._count === "object" ? (entry._count.brand ?? 0) : 0,
          }))
          .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand)),
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop products list", error);
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = await request.json();
    const { data, errors } = normalizeAdminProductPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }
    const hasNormalizedFitment = Object.prototype.hasOwnProperty.call(body, "normalizedFitment");
    const automaticFitment = buildAutomaticFitmentFromAdminPayload(data);
    const automaticFitmentValue = shouldPersistAutomaticFitment(automaticFitment)
      ? JSON.stringify(automaticFitment)
      : null;
    let normalizedFitmentValue: string | null = automaticFitmentValue;
    if (hasNormalizedFitment && body.normalizedFitment !== null) {
      const normalized = normalizeManualFitment(body.normalizedFitment, session.email);
      if (normalized.errors.length || !normalized.data) {
        return NextResponse.json(
          { error: normalized.errors.join(", ") || "Invalid normalized fitment" },
          { status: 400 }
        );
      }
      normalizedFitmentValue = JSON.stringify(normalized.data);
    }
    if (data.categoryId) {
      const category = await prisma.shopCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: "Selected category not found" }, { status: 400 });
      }
    }
    const existing = await prisma.shopProduct.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: "Product with this slug already exists" }, { status: 409 });
    }
    const catalogMutation = await coordinateShopCatalogProductCreation({
      changeDomains: [
        "CONTENT",
        "SEO",
        "MEDIA",
        "PRICE",
        "INVENTORY",
        "FITMENT",
        "TAXONOMY",
        "VISIBILITY",
      ],
      async create(tx) {
        const createdProduct = await tx.shopProduct.create({
          data: buildAdminProductCreateData(data),
          select: { id: true },
        });
        if (
          String(data.image ?? "").trim() ||
          data.media.some((item) => String(item.src ?? "").trim()) ||
          (Array.isArray(data.gallery) && data.gallery.some((item) => String(item ?? "").trim()))
        ) {
          await tx.shopProductMetafield.create({
            data: {
              productId: createdProduct.id,
              namespace: SHOP_PRODUCT_ADMIN_MEDIA_NAMESPACE,
              key: SHOP_PRODUCT_ADMIN_MEDIA_KEY,
              value: "true",
            },
          });
        }
        if (normalizedFitmentValue) {
          await tx.shopProductMetafield.create({
            data: {
              productId: createdProduct.id,
              namespace: NORMALIZED_FITMENT_NAMESPACE,
              key: NORMALIZED_FITMENT_KEY,
              value: normalizedFitmentValue,
              valueType: "json",
            },
          });
        }
        return createdProduct.id;
      },
      async snapshot(tx, productId, initialCatalogVersion) {
        await writeAdminAuditLog(tx, session, {
          scope: "shop",
          action: "product.create",
          entityType: "shop.product",
          entityId: productId,
          metadata: {
            slug: data.slug,
            status: data.status,
            catalogVersion: initialCatalogVersion,
          },
        });
        return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
          type: "ADMIN",
          id: session.email,
          reason: "product.create",
        });
      },
    });
    const product = await prisma.shopProduct.findUniqueOrThrow({
      where: { id: catalogMutation.productId },
      include: adminProductInclude,
    });

    after(async () => {
      try {
        await runShopCatalogOutboxRuntime({
          workerId: `catalog-product-create:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          limit: 10,
        });
      } catch (error) {
        console.error(
          "[shop-catalog.product-create] immediate publish failed; cron recovery remains active",
          {
            outboxId: catalogMutation.outboxId,
            error,
          }
        );
      }
    });
    try {
      revalidateShopStorefrontProduct(product);
    } catch (e) {
      console.error("[revalidate] Error:", e);
    }

    return NextResponse.json({
      ...serializeAdminProductListItem(product),
      catalog: {
        version: catalogMutation.canonicalVersion,
        revisionId: catalogMutation.revisionId,
        outboxId: catalogMutation.outboxId,
        status: "SAVED",
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop product create", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
