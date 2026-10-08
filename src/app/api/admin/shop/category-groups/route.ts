import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { normalizeShopSearchText } from "@/lib/shopSearch";
import {
  defaultShopCategoryGroupSettings,
  mergeShopCategoryGroupSettings,
  normalizeShopCategoryGroupSettingsPayload,
} from "@/lib/shopCategoryGroupSettings";
import { invalidateShopCategoryGroupSettings } from "@/lib/shopCategoryGroupSettings.server";

function authError(error: unknown) {
  const message = (error as Error).message;
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

async function currentGroups() {
  const rows = await prisma.shopCategoryGroup.findMany();
  const groups = mergeShopCategoryGroupSettings(rows);
  const counts = await prisma.shopCatalogProjection.groupBy({
    by: ["categoryGroupKey"],
    where: { locale: "ua", isPublished: true, statusKey: "ACTIVE" },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((row) => [row.categoryGroupKey, row._count._all]));
  return groups.map((group) => ({ ...group, productsCount: countById.get(group.id) ?? 0 }));
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_READ);
    return NextResponse.json(await currentGroups());
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("Admin category groups list", error);
    return NextResponse.json({ error: "Failed to list category groups" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CATEGORIES_WRITE);
    const { data, errors } = normalizeShopCategoryGroupSettingsPayload(await request.json());
    if (errors.length) return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    // Filter values that match an admin category slug/label must stay reachable as that category.
    const categories = await prisma.shopCategory.findMany({
      select: { slug: true, titleUa: true, titleEn: true },
    });
    const reserved = new Set(
      categories.flatMap((category) =>
        [category.slug, category.titleUa, category.titleEn].map((value) => normalizeShopSearchText(value))
      )
    );
    // Built-in titles stay allowed so an untouched group can always be saved.
    const builtIn = new Set(
      defaultShopCategoryGroupSettings().flatMap((group) => [
        normalizeShopSearchText(group.titleUa),
        normalizeShopSearchText(group.titleEn),
      ])
    );
    const clashes = data
      .flatMap((group) => [group.titleUa, group.titleEn])
      .filter((title) => {
        const key = normalizeShopSearchText(title);
        return reserved.has(key) && !builtIn.has(key);
      });
    if (clashes.length) {
      return NextResponse.json(
        { error: `Назва збігається з адмін-категорією: ${[...new Set(clashes)].join(", ")}` },
        { status: 400 }
      );
    }
    await prisma.$transaction(
      data.map((group) =>
        prisma.shopCategoryGroup.upsert({
          where: { id: group.id },
          create: group,
          update: {
            titleUa: group.titleUa,
            titleEn: group.titleEn,
            sortOrder: group.sortOrder,
            isPublished: group.isPublished,
          },
        })
      )
    );
    invalidateShopCategoryGroupSettings();
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "category-groups.update",
      entityType: "shop.category-group",
      entityId: "all",
      metadata: { groups: data.map((group) => group.id) },
    });
    return NextResponse.json(await currentGroups());
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("Admin category groups update", error);
    return NextResponse.json({ error: "Failed to update category groups" }, { status: 500 });
  }
}
