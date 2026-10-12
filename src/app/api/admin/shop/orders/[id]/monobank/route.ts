import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { prepareAdminMonobankPayment } from "@/lib/shopAdminMonobank";
import { isMonobankEnabled, MonobankError } from "@/lib/shopMonobank";

// Up to two Mono calls (status read + invoice create, 15 s timeout each) plus DB work.
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let orderId = "unknown";
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
    const { id } = await params;
    orderId = id;
    const body = await request.json().catch(() => ({}));
    const replacePreviousProvider = body?.replacePreviousProvider === true;
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: replacePreviousProvider
        ? "order.monobank.previous_provider_replaced"
        : "order.monobank.payment_link_requested",
      entityType: "shop.order",
      entityId: id,
    });
    const link = await prepareAdminMonobankPayment(
      prisma,
      id,
      body?.locale === "en" ? "en" : "ua",
      session.name,
      { replacePreviousProvider }
    );
    return NextResponse.json(link, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code =
      error instanceof MonobankError
        ? error.code
        : error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
          ? error.message
          : "MONOBANK_PAYMENT_UNAVAILABLE";
    console.error("[Admin mono payment link] request failed", {
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
      }
    );
  }
}
