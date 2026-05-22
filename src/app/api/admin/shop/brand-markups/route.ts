/**
 * GET / PUT / DELETE /api/admin/shop/brand-markups
 *
 * Admin CRUD for SYSTEM-WIDE per-brand B2B discount overrides. Applies
 * to all B2B-approved customers unless overridden by an entry in
 * ShopCustomerBrandDiscount.
 *
 * Edited via /admin/shop/brand-markups UI.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import {
  deleteBrandB2bDiscount,
  listBrandB2bDiscounts,
  upsertBrandB2bDiscount,
} from "@/lib/shopBrandB2bDiscounts";

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    const rows = await listBrandB2bDiscounts(prisma);
    return NextResponse.json({
      discounts: rows.map((r) => ({
        id: r.id,
        brand: r.brand,
        discountPct: r.discountPct,
        notes: r.notes,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const body = (await request.json().catch(() => ({}))) as {
      brand?: string;
      discountPct?: number;
      notes?: string | null;
    };
    const row = await upsertBrandB2bDiscount(prisma, {
      brand: String(body.brand ?? ""),
      discountPct: Number(body.discountPct ?? 0),
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "brand_markup.upsert",
      entityType: "shop.brand",
      entityId: row.brand,
      metadata: { discountPct: row.discountPct },
    });
    return NextResponse.json({
      discount: {
        id: row.id,
        brand: row.brand,
        discountPct: row.discountPct,
        notes: row.notes,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const url = new URL(request.url);
    const brand = url.searchParams.get("brand") ?? "";
    if (!brand) {
      return NextResponse.json({ error: "brand query param required" }, { status: 400 });
    }
    await deleteBrandB2bDiscount(prisma, brand);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "brand_markup.delete",
      entityType: "shop.brand",
      entityId: brand,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  const msg = (error as Error).message;
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (msg === "BRAND_REQUIRED")
    return NextResponse.json({ error: "Brand is required" }, { status: 400 });
  if (msg === "DISCOUNT_OUT_OF_RANGE")
    return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
  console.error("Admin brand-markups", error);
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}

export const runtime = "nodejs";
