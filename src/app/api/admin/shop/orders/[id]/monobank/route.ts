import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { prepareAdminMonobankPayment } from "@/lib/shopAdminMonobank";
import { isMonobankEnabled, MonobankError } from "@/lib/shopMonobank";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const url = await prepareAdminMonobankPayment(
      prisma,
      id,
      body?.locale === "en" ? "en" : "ua",
      session.name
    );
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "order.monobank.payment_link",
      entityType: "shop.order",
      entityId: id,
    });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code =
      error instanceof MonobankError
        ? error.code
        : error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
          ? error.message
          : "MONOBANK_PAYMENT_UNAVAILABLE";
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
                : 409,
      }
    );
  }
}
