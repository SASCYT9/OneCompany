import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type OrderStatus } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminOrderListInclude,
  ALL_ORDER_STATUSES,
  canTransitionOrderStatus,
  serializeAdminOrderListRow,
} from "@/lib/shopAdminOrders";
import {
  composeOrderStatusNote,
  ORDER_LIST_TABS,
  ORDER_STALE_DAYS,
  ORDER_STALE_STATUSES,
  ORDER_STATUS_PROBLEM_TEXT,
  orderListTab,
  orderStatusChangeProblem,
  orderStatusReasonMissing,
} from "@/lib/admin/orderWorkflow";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function searchWhere(query: string): Prisma.ShopOrderWhereInput {
  // Every word must match somewhere: «іван akrapovic» finds Ivan's Akrapovic order.
  const words = query.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: words.map((word) => ({
      OR: [
        { orderNumber: { contains: word, mode: "insensitive" } },
        { email: { contains: word, mode: "insensitive" } },
        { customerName: { contains: word, mode: "insensitive" } },
        { phone: { contains: word, mode: "insensitive" } },
        { ttnNumber: { contains: word, mode: "insensitive" } },
        { customer: { companyName: { contains: word, mode: "insensitive" } } },
        {
          items: {
            some: {
              OR: [
                { title: { contains: word, mode: "insensitive" } },
                { productSlug: { contains: word, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const params = request.nextUrl.searchParams;
    const tab = orderListTab(params.get("tab"));
    const query = params.get("q")?.trim().slice(0, 200) || "";
    const stale = params.get("stale") === "1";
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(10, Number.parseInt(params.get("pageSize") ?? "", 10) || DEFAULT_PAGE_SIZE)
    );
    const requestedPage = Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1);

    const baseWhere: Prisma.ShopOrderWhereInput = {
      isDraft: false,
      ...(query ? searchWhere(query) : {}),
    };
    const staleWhere: Prisma.ShopOrderWhereInput = {
      status: { in: ORDER_STALE_STATUSES },
      createdAt: { lt: new Date(Date.now() - ORDER_STALE_DAYS * 86_400_000) },
    };
    const where: Prisma.ShopOrderWhereInput = stale
      ? { AND: [baseWhere, staleWhere] }
      : {
          ...baseWhere,
          ...(tab.statuses.length ? { status: { in: [...tab.statuses] } } : {}),
        };

    const [total, grouped, staleCount] = await Promise.all([
      prisma.shopOrder.count({ where }),
      prisma.shopOrder.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
      prisma.shopOrder.count({ where: { AND: [baseWhere, staleWhere] } }),
    ]);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const rows = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: adminOrderListInclude,
    });

    const statusCounts = Object.fromEntries(
      grouped.map((entry) => [entry.status, entry._count._all])
    ) as Partial<Record<OrderStatus, number>>;
    const tabCounts = Object.fromEntries(
      ORDER_LIST_TABS.map((entry) => [
        entry.key,
        entry.statuses.length
          ? entry.statuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)
          : Object.values(statusCounts).reduce((sum, count) => sum + (count ?? 0), 0),
      ])
    );

    return NextResponse.json({
      orders: rows.map(serializeAdminOrderListRow),
      total,
      page,
      pages,
      pageSize,
      tab: tab.key,
      tabCounts,
      staleCount,
      customerEmailsEnabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    });
  } catch (e) {
    if ((e as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((e as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop orders list", e);
    return NextResponse.json({ error: "Failed to list orders" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const body = await request.json().catch(() => ({}));
    const rawOrderIds: unknown[] = Array.isArray(body.orderIds) ? body.orderIds : [];
    const orderIds: string[] = Array.from(
      new Set(rawOrderIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean))
    );
    const status = String(body.status ?? "")
      .trim()
      .toUpperCase() as OrderStatus;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    if (!orderIds.length) {
      return NextResponse.json({ error: "Оберіть хоча б одне замовлення." }, { status: 400 });
    }
    if (orderIds.length > MAX_PAGE_SIZE) {
      return NextResponse.json(
        { error: `За раз можна змінити до ${MAX_PAGE_SIZE} замовлень.` },
        { status: 400 }
      );
    }

    if (!ALL_ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Оберіть статус." }, { status: 400 });
    }

    const orders = await prisma.shopOrder.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
        amountPaid: true,
        paymentStatus: true,
        isDraft: true,
      },
    });

    const missingOrderIds = orderIds.filter(
      (orderId) => !orders.some((order) => order.id === orderId)
    );
    if (missingOrderIds.length) {
      return NextResponse.json(
        { error: "Деякі замовлення не знайдено. Оновіть список.", missingOrderIds },
        { status: 404 }
      );
    }

    const changedOrders = orders.filter((order) => order.status !== status);
    const invalidOrders = changedOrders
      .map((order) => ({
        order,
        problem: !canTransitionOrderStatus(order.status, status)
          ? ("TRANSITION_NOT_ALLOWED" as const)
          : orderStatusChangeProblem(order, status),
      }))
      .filter((entry) => entry.problem);
    if (invalidOrders.length) {
      return NextResponse.json(
        {
          error: `Не можна змінити: ${invalidOrders
            .map((entry) => `${entry.order.orderNumber} (${ORDER_STATUS_PROBLEM_TEXT[entry.problem!]})`)
            .join("; ")}`,
          invalidOrders: invalidOrders.map((entry) => ({
            id: entry.order.id,
            orderNumber: entry.order.orderNumber,
            fromStatus: entry.order.status,
            toStatus: status,
            problem: entry.problem,
          })),
        },
        { status: 409 }
      );
    }
    if (
      changedOrders.some((order) =>
        orderStatusReasonMissing({ from: order.status, to: status, reason, note })
      )
    ) {
      return NextResponse.json({ error: ORDER_STATUS_PROBLEM_TEXT.REASON_REQUIRED }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const order of changedOrders) {
        const claimed = await tx.shopOrder.updateMany({
          where: { id: order.id, updatedAt: order.updatedAt, status: order.status },
          data: { status },
        });
        if (claimed.count !== 1) throw new Error("ORDER_CHANGED");
        await tx.shopOrderStatusEvent.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: status,
            actorType: "admin",
            actorName: session.name,
            note: composeOrderStatusNote({ from: order.status, to: status, reason, note }),
          },
        });
      }
    });

    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "order.bulk-status.update",
      entityType: "shop.order",
      metadata: {
        orderIds,
        changedOrderIds: changedOrders.map((order) => order.id),
        toStatus: status,
        reason: reason ?? null,
        note: note || null,
      },
    });

    return NextResponse.json({
      updatedCount: changedOrders.length,
      skippedCount: orders.length - changedOrders.length,
      status,
    });
  } catch (e) {
    if ((e as Error).message === "ORDER_CHANGED") {
      return NextResponse.json(
        { error: "Одне із замовлень щойно змінилося. Оновіть список і повторіть." },
        { status: 409 }
      );
    }
    if ((e as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((e as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop orders bulk update", e);
    return NextResponse.json({ error: "Не вдалося оновити замовлення." }, { status: 500 });
  }
}
