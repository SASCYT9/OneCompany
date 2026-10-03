import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { type OrderStatus } from "@prisma/client";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminOrderInclude,
  canTransitionOrderStatus,
  serializeAdminOrder,
} from "@/lib/shopAdminOrders";
import { prisma } from "@/lib/prisma";
import OrderStatusEmail from "@/components/emails/OrderStatusEmail";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

const ALLOWED_STATUSES: OrderStatus[] = [
  "PENDING_REVIEW",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const { id } = await params;
    const order = await prisma.shopOrder.findUnique({
      where: { id },
      include: adminOrderInclude,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const serialized = serializeAdminOrder(order);
    for (const item of serialized.items) {
      if (!item.image && item.sku) {
        const t14 = await prisma.turn14Item.findFirst({ where: { partNumber: item.sku } });
        if (t14?.thumbnail) item.image = t14.thumbnail;
      }
    }
    return NextResponse.json(serialized);
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((e as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop order get", e);
    return NextResponse.json({ error: "Failed to get order" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = body.status as string | undefined;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    const currentOrder = await prisma.shopOrder.findUnique({
      where: { id },
      select: {
        id: true, status: true, updatedAt: true, subtotal: true, taxAmount: true,
        shippingCost: true, paymentMethod: true, monobankPayment: { select: { id: true } },
      },
    });
    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (status) {
      if (!ALLOWED_STATUSES.includes(status as OrderStatus))
        return NextResponse.json({ error: "Valid status required" }, { status: 400 });
      updateData.status = status as OrderStatus;
    }

    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.amountPaid !== undefined) updateData.amountPaid = Number(body.amountPaid);
    if (body.deliveryMethod !== undefined) updateData.deliveryMethod = body.deliveryMethod || null;
    if (body.ttnNumber !== undefined) updateData.ttnNumber = body.ttnNumber || null;
    if (body.shippingCalculatedCost !== undefined) {
      const shippingCalculatedCost = body.shippingCalculatedCost
        ? Number(body.shippingCalculatedCost)
        : null;
      const shippingCost = shippingCalculatedCost ?? 0;
      if (!Number.isFinite(shippingCost) || shippingCost < 0) {
        return NextResponse.json({ error: "Valid shipping cost required" }, { status: 400 });
      }
      const shippingChanged = shippingCost !== currentOrder.shippingCost.toNumber();
      if (
        shippingChanged &&
        (currentOrder.paymentMethod === "MONOBANK" || currentOrder.monobankPayment)
      ) {
        return NextResponse.json(
          { error: "Суму доставки не можна змінити після підготовки платежу mono." },
          { status: 409 }
        );
      }
      if (shippingChanged && currentOrder.paymentMethod === "MANAGER_QUOTE") {
        return NextResponse.json(
          { error: "Погодьте міжнародну доставку через блок «Міжнародна доставка та оплата»." },
          { status: 409 }
        );
      }
      updateData.shippingCalculatedCost = shippingCalculatedCost;
      if (shippingChanged) {
        updateData.shippingCost = shippingCost;
        updateData.total = Number(
          (
            currentOrder.subtotal.toNumber() +
            currentOrder.taxAmount.toNumber() +
            (updateData.shippingCost || 0)
          ).toFixed(2)
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }
    if (
      updateData.status &&
      !canTransitionOrderStatus(currentOrder.status, updateData.status as OrderStatus)
    ) {
      return NextResponse.json(
        { error: `Invalid transition: ${currentOrder.status} -> ${updateData.status}` },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopOrder.updateMany({
        where: { id, updatedAt: currentOrder.updatedAt },
        data: updateData,
      });
      if (claimed.count !== 1) throw new Error("ORDER_CHANGED");
      const updatedOrder = await tx.shopOrder.findUniqueOrThrow({ where: { id } });

      if (updateData.status && currentOrder.status !== updateData.status) {
        await tx.shopOrderStatusEvent.create({
          data: {
            orderId: id,
            fromStatus: currentOrder.status,
            toStatus: updateData.status as OrderStatus,
            actorType: "admin",
            actorName: session.name,
            note: note || null,
          },
        });
      }

      return updatedOrder;
    });
    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "order.status.update",
      entityType: "shop.order",
      entityId: order.id,
      metadata: {
        fromStatus: currentOrder.status,
        toStatus: updateData.status || currentOrder.status,
        note: note || null,
        updates: updateData,
      },
    });

    // ── Send status-change email for SHIPPED / DELIVERED ──
    if (
      updateData.status &&
      (updateData.status === "SHIPPED" || updateData.status === "DELIVERED") &&
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM
    ) {
      try {
        const fullOrder = await prisma.shopOrder.findUnique({
          where: { id },
          include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
        });
        if (fullOrder?.email) {
          const b =
            process.env.NEXT_PUBLIC_SITE_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "https://onecompany.global");
          const latestShipment = fullOrder.shipments[0];
          const locale = "ua";
          const viewOrderUrl = `${b}/${locale}/shop/checkout/success?order=${encodeURIComponent(fullOrder.orderNumber)}&token=${encodeURIComponent(fullOrder.viewToken)}`;

          const emailHtml = await render(
            OrderStatusEmail({
              orderNumber: fullOrder.orderNumber,
              customerName: fullOrder.customerName,
              newStatus: updateData.status as "SHIPPED" | "DELIVERED",
              locale,
              viewOrderUrl,
              trackingNumber:
                (fullOrder as any).ttnNumber || latestShipment?.trackingNumber || null,
              carrier: latestShipment?.carrier || (fullOrder as any).deliveryMethod || null,
              trackingUrl: latestShipment?.trackingUrl || null,
            })
          );

          const subjectMap: Record<string, string> = {
            SHIPPED: `Замовлення ${fullOrder.orderNumber} відправлено 🚚`,
            DELIVERED: `Замовлення ${fullOrder.orderNumber} доставлено ✅`,
          };

          await resend.emails.send({
            from: `One Company <${process.env.EMAIL_FROM}>`,
            to: [fullOrder.email],
            subject:
              subjectMap[updateData.status] || `Оновлення замовлення ${fullOrder.orderNumber}`,
            html: emailHtml,
          });
          console.log(`[Order ${fullOrder.orderNumber}] Status email sent: ${updateData.status}`);
        }
      } catch (emailErr) {
        console.error("[Order status email] Failed:", emailErr);
      }
    }

    return NextResponse.json({ id: order.id, status: order.status });
  } catch (e) {
    if ((e as Error).message === "ORDER_CHANGED") {
      return NextResponse.json(
        { error: "Замовлення вже змінилося. Оновіть сторінку та перевірте поточну суму." },
        { status: 409 }
      );
    }
    if ((e as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((e as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop order update", e);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
