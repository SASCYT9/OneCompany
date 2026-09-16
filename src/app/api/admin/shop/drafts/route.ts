import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { assertAdminRequest } from "@/lib/adminAuth";
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import {
  draftMoney,
  draftTotals,
  validateDraftBody,
  type CreateDraftBody,
} from "@/lib/admin/proformaDraft";

/**
 * GET  /api/admin/shop/drafts        → list draft orders
 * POST /api/admin/shop/drafts        → create a new draft (B2B quote)
 *
 * GET filters:
 *   ?status=PENDING_REVIEW|...    (active draft only; drafts can be in any non-cancelled status)
 *   ?customerId=...
 *   ?search={term}
 *
 * POST body:
 *   {
 *     customerId?: string,
 *     email: string,
 *     customerName: string,
 *     phone?: string,
 *     currency: string,
 *     shippingAddress: { ... },
 *     items: [{ productSlug, productId?, variantId?, title, quantity, price }],
 *     shippingCost?: number,
 *     internalNote?: string,
 *     validUntil?: ISO string
 *   }
 */

function generateDraftToken(): string {
  return randomBytes(24).toString("base64url");
}

function generateDraftOrderNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DRAFT-${year}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_READ);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || "";
    const search = searchParams.get("search")?.trim() || "";

    const where: Record<string, unknown> = { isDraft: true };
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    const drafts = await prisma.shopOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, group: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        orderNumber: d.orderNumber,
        customerId: d.customerId,
        customerName: d.customerName,
        email: d.email,
        currency: d.currency,
        subtotal: Number(d.subtotal),
        total: Number(d.total),
        itemsCount: d._count.items,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftQuoteToken: (d as any).draftQuoteToken,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteSentAt: (d as any).quoteSentAt ? (d as any).quoteSentAt.toISOString() : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteAcceptedAt: (d as any).quoteAcceptedAt
          ? (d as any).quoteAcceptedAt.toISOString()
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteDeclinedAt: (d as any).quoteDeclinedAt
          ? (d as any).quoteDeclinedAt.toISOString()
          : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        draftValidUntil: (d as any).draftValidUntil
          ? (d as any).draftValidUntil.toISOString()
          : null,
        customerGroupSnapshot: d.customerGroupSnapshot,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Drafts list error:", error);
    return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);

    const input: unknown = await request.json().catch(() => null);
    const validation = validateDraftBody(input);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    const body = input as CreateDraftBody;

    let customerGroup: "B2C" | "B2B_PENDING" | "B2B_APPROVED" = "B2C";
    if (body.customerId) {
      const customer = await prisma.shopCustomer.findUnique({
        where: { id: body.customerId },
        select: { group: true },
      });
      if (!customer)
        return NextResponse.json({ error: "Клієнта не знайдено. Оновіть вибір." }, { status: 400 });
      customerGroup = customer.group as typeof customerGroup;
    }

    const productIds = [
      ...new Set(body.items.flatMap((item) => (item.productId ? [item.productId] : []))),
    ];
    const products = productIds.length
      ? await prisma.shopProduct.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            slug: true,
            sku: true,
            variants: { select: { id: true, sku: true, title: true } },
          },
        })
      : [];
    for (const item of body.items) {
      const product = products.find((entry) => entry.id === item.productId);
      if (
        (item.productId && (!product || product.slug !== item.productSlug)) ||
        (item.variantId && !product?.variants.some((variant) => variant.id === item.variantId))
      ) {
        return NextResponse.json(
          {
            error:
              "Товар або його варіант змінився. Приберіть позицію та додайте її з каталогу ще раз.",
          },
          { status: 400 }
        );
      }
    }
    const shippingCost = body.shippingCost ?? 0;
    const taxAmount = body.taxAmount ?? 0;
    const { subtotal, total } = draftTotals(body.items, shippingCost, taxAmount);

    const orderNumber = generateDraftOrderNumber();
    const viewToken = generateDraftToken();
    const draftQuoteToken = generateDraftToken();

    const draft = await prisma.$transaction(async (tx) => {
      const created = await tx.shopOrder.create({
        data: {
          orderNumber,
          viewToken,
          status: "PENDING_REVIEW",
          email: body.email.trim(),
          customerName: body.customerName.trim(),
          phone: body.phone ?? null,
          customerId: body.customerId ?? null,
          customerGroupSnapshot: customerGroup,
          currency: body.currency,
          subtotal,
          shippingCost,
          taxAmount,
          total,
          shippingAddress: (body.shippingAddress ?? {}) as object,
          pricingSnapshot: {
            items: body.items.map((item) => {
              const product = products.find((entry) => entry.id === item.productId);
              const variant = product?.variants.find((entry) => entry.id === item.variantId);
              return {
                slug: item.productSlug,
                variantId: item.variantId ?? null,
                sku: variant?.sku || product?.sku || item.sku || null,
                variantTitle: variant?.title ?? null,
              };
            }),
          },

          ...({
            isDraft: true,
            draftQuoteToken,
            draftValidUntil: body.validUntil ? new Date(body.validUntil) : null,
            internalNote: body.internalNote ?? null,
          } as Record<string, unknown>),
          items: {
            create: body.items.map((it) => ({
              productSlug: it.productSlug,
              productId: it.productId ?? null,
              variantId: it.variantId ?? null,
              title: it.title,
              quantity: it.quantity,
              price: draftMoney(it.price),
              total: draftTotals([it]).total,
              image: it.image ?? null,
            })),
          },
        },
      });

      await writeAdminAuditLog(tx, session, {
        scope: "shop",
        action: "draft.create",
        entityType: "shop.order",
        entityId: created.id,
        metadata: { orderNumber, isDraft: true, customerId: body.customerId, total },
      });
      return created;
    });

    return NextResponse.json({ id: draft.id, orderNumber: draft.orderNumber, draftQuoteToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Draft create error:", error);
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
  }
}
