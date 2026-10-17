/**
 * POST /api/admin/shop/orders/[id]/monobank/cancel — «Змінити замовлення»: invalidates the
 * order's open mono link at the bank and reopens the order for item, price and currency
 * changes (see `cancelAdminMonobankLink`).
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { cancelAdminMonobankLink } from "@/lib/shopAdminMonobank";
import { MonobankError } from "@/lib/shopMonobank";

// A status read and an invalidation at the bank (15 s timeout each) plus DB work.
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let orderId = "unknown";
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    orderId = id;
    const result = await cancelAdminMonobankLink(prisma, id, session.name);
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "order.monobank.payment_link_cancelled",
      entityType: "shop.order",
      entityId: id,
      metadata: { invoiceId: result.invoiceId, international: result.international },
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code =
      error instanceof MonobankError
        ? error.code
        : error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
          ? error.message
          : "MONOBANK_PAYMENT_UNAVAILABLE";
    console.error("[Admin mono link cancel] failed", {
      orderId,
      code,
      requestId: request.headers.get("x-vercel-id"),
    });
    return NextResponse.json(
      { error: code },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "FORBIDDEN"
              ? 403
              : code === "ORDER_NOT_FOUND"
                ? 404
                : code === "MONOBANK_NOT_CONFIGURED"
                  ? 503
                  : code.startsWith("MONOBANK_HTTP_") ||
                      code === "MONOBANK_REQUEST_UNCERTAIN" ||
                      code === "MONOBANK_PAYMENT_UNAVAILABLE"
                    ? 502
                    : error instanceof MonobankError
                      ? 409
                      : 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
