import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { catalogImageSources } from "@/lib/admin/catalogImageSources";
import { adminProductListSelect, serializeAdminProductListItem } from "@/lib/shopAdminCatalog";
import {
  countShopCatalogProjection,
  queryShopCatalogProjection,
} from "@/lib/shopCatalogProjectionQuery.server";
import { prisma } from "@/lib/prisma";

/**
 * Catalog builder discovery is intentionally powered by the same V2 projection
 * that drives the storefront search. The canonical product read below only
 * hydrates the bounded result with admin-only prices and all image fallbacks.
 */
export async function GET(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 50);
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 50;
    const query = {
      locale: "ua",
      text: search || null,
      limit,
      offset: (page - 1) * limit,
      order: "default",
    } as const;
    const [projection, totalCount] = await Promise.all([
      queryShopCatalogProjection(query),
      countShopCatalogProjection(query),
    ]);
    const ids = projection.items.map((item) => item.productId);
    if (ids.length === 0) {
      return NextResponse.json({
        products: [],
        metadata: {
          totalCount,
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
          limit,
        },
        source: projection.source,
      });
    }

    const rows = await prisma.shopProduct.findMany({
      where: { id: { in: ids } },
      select: adminProductListSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const products = projection.items.flatMap((item) => {
      const row = byId.get(item.productId);
      if (!row) return [];
      const serialized = serializeAdminProductListItem(row);
      const projectionPrice = (value: string | null) => {
        const parsed = value == null ? NaN : Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };
      const imageSources = catalogImageSources([
        item.primaryMediaUrl,
        serialized.imageUrl,
        ...serialized.imageSources,
      ]);
      return [
        {
          ...serialized,
          priceEur: serialized.priceEur ?? projectionPrice(item.minPriceEur),
          priceUsd: serialized.priceUsd ?? projectionPrice(item.minPriceUsd),
          priceUah: serialized.priceUah ?? projectionPrice(item.minPriceUah),
          imageUrl: imageSources[0] ?? null,
          imageSources,
          catalogSource: projection.source,
          catalogVersion: item.projectionVersion,
        },
      ];
    });

    return NextResponse.json(
      {
        products,
        metadata: {
          totalCount,
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
          limit,
        },
        source: projection.source,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Admin Catalog V2 product discovery failed", error);
    return NextResponse.json(
      { error: "Catalog V2 зараз недоступний для пошуку товарів." },
      { status: 503 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
