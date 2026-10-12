import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";

import {
  assertCurrentAdminAnyPermission,
  currentAdminHasPermission,
} from "@/lib/admin/adminAccess";
import {
  ADMIN_ATTENTION_IMPORT_WINDOW_DAYS,
  type AdminAttentionCounts,
} from "@/lib/admin/adminAttention";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { DASHBOARD_WINDOW_DAYS } from "@/lib/admin/dashboardOverview";
import { prisma } from "@/lib/prisma";

const skip = Promise.resolve(null);
const ATTENTION_PERMISSIONS = [
  ADMIN_PERMISSIONS.SHOP_ORDERS_READ,
  ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ,
  ADMIN_PERMISSIONS.SHOP_SETTINGS_READ,
  ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE,
] as const;

/** Cheap COUNT-only counters for the shell badges and bell; polled by every admin page. */
export async function GET() {
  try {
    const access = await assertCurrentAdminAnyPermission(ATTENTION_PERMISSIONS);
    const canReadOrders = currentAdminHasPermission(access, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const canReadCustomers = currentAdminHasPermission(
      access,
      ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ
    );
    const canReadMessages = currentAdminHasPermission(access, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    const canManageImports = currentAdminHasPermission(
      access,
      ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE
    );
    const importWindowStart = new Date(
      Date.now() - ADMIN_ATTENTION_IMPORT_WINDOW_DAYS * 86_400_000
    );
    // Same window as the dashboard, so the badge and "На перевірці" show the same number.
    const orderWindowStart = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 86_400_000);

    const [
      ordersToReview,
      unpaidHighValueOrders,
      returnsRequested,
      newMessages,
      b2bPending,
      failedImportsRecent,
    ] = await Promise.all([
      canReadOrders
        ? prisma.shopOrder.count({
            where: {
              isDraft: false,
              status: OrderStatus.PENDING_REVIEW,
              createdAt: { gte: orderWindowStart },
            },
          })
        : skip,
      canReadOrders
        ? prisma.shopOrder.count({
            where: {
              isDraft: false,
              createdAt: { gte: orderWindowStart },
              status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
              paymentStatus: { not: "PAID" },
              total: { gte: 1000 },
            },
          })
        : skip,
      canReadOrders ? prisma.shopOrderReturn.count({ where: { status: "REQUESTED" } }) : skip,
      canReadMessages ? prisma.message.count({ where: { status: "NEW" } }) : skip,
      canReadCustomers
        ? prisma.shopCustomer.count({
            where: { group: "B2B_PENDING", isActive: true, archivedAt: null },
          })
        : skip,
      canManageImports
        ? prisma.shopImportJob.count({
            where: { status: "FAILED", createdAt: { gte: importWindowStart } },
          })
        : skip,
    ]);

    const counts: AdminAttentionCounts = {
      ordersToReview,
      unpaidHighValueOrders,
      returnsRequested,
      newMessages,
      b2bPending,
      failedImportsRecent,
    };
    return NextResponse.json(counts, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shell attention counters failed", error);
    return NextResponse.json({ error: "Failed to load attention counters" }, { status: 500 });
  }
}
