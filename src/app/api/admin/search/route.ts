import { NextRequest, NextResponse } from "next/server";

import { assertCurrentAdminAccess, currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";

const TAKE_PER_GROUP = 6;
const MAX_QUERY_WORDS = 5;

/** Every word must hit at least one field, so "akrapovic m3" finds the M3 Akrapovic system. */
function everyWordIn<Field extends string>(words: string[], fields: readonly Field[]) {
  return {
    AND: words.map((word) => ({
      OR: fields.map((field) => ({ [field]: { contains: word, mode: "insensitive" as const } })),
    })),
  } as { AND: Array<{ OR: Array<Record<Field, { contains: string; mode: "insensitive" }>> }> };
}

function toNumber(value: unknown) {
  if (value == null) return 0;
  return Number(value);
}

export async function GET(request: NextRequest) {
  try {
    const access = await assertCurrentAdminAccess();
    const canReadOrders = currentAdminHasPermission(access, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const canReadProducts = currentAdminHasPermission(access, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const canReadCustomers = currentAdminHasPermission(
      access,
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ
    );
    if (!canReadOrders && !canReadProducts && !canReadCustomers) {
      throw new Error("FORBIDDEN");
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 2) {
      return NextResponse.json({
        query,
        total: 0,
        results: { orders: [], products: [], customers: [] },
      });
    }

    const words = query.split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_WORDS);

    const [orders, products, customers] = await Promise.all([
      canReadOrders
        ? prisma.shopOrder.findMany({
            where: everyWordIn(words, ["orderNumber", "email", "customerName"] as const),
            orderBy: { createdAt: "desc" },
            take: TAKE_PER_GROUP,
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              email: true,
              status: true,
              paymentStatus: true,
              total: true,
              amountPaid: true,
              currency: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
      canReadProducts
        ? prisma.shopProduct.findMany({
            where: everyWordIn(words, [
              "sku",
              "slug",
              "brand",
              "vendor",
              "titleUa",
              "titleEn",
            ] as const),
            orderBy: { updatedAt: "desc" },
            take: TAKE_PER_GROUP,
            select: {
              id: true,
              slug: true,
              sku: true,
              brand: true,
              titleUa: true,
              titleEn: true,
              status: true,
              isPublished: true,
              stock: true,
            },
          })
        : Promise.resolve([]),
      canReadCustomers
        ? prisma.shopCustomer.findMany({
            where: everyWordIn(words, ["email", "firstName", "lastName", "companyName"] as const),
            orderBy: { updatedAt: "desc" },
            take: TAKE_PER_GROUP,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
              group: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      query,
      total: orders.length + products.length + customers.length,
      results: {
        orders: orders.map((order) => ({
          ...order,
          total: toNumber(order.total),
          amountPaid: toNumber(order.amountPaid),
          outstandingAmount: Math.max(0, toNumber(order.total) - toNumber(order.amountPaid)),
          createdAt: order.createdAt.toISOString(),
        })),
        products,
        customers,
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin global search failed", error);
    return NextResponse.json({ error: "Failed to search admin data" }, { status: 500 });
  }
}
