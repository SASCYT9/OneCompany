import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { orderAddressText } from "@/lib/shopOrderPresentation";
import {
  appendOrderSnapshotItems,
  describeContactChanges,
  formatOrderMoney,
  mergeOrderAddress,
  OrderEditError,
  orderAmountLock,
  type OrderItemAdd,
  parseOrderEditRequest,
  planOrderItemsEdit,
} from "@/lib/admin/orderEditing";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * PATCH /api/admin/shop/orders/[id]/edit — correct contacts, address and items of a
 * placed order in one step. Every change is written to the order history.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    const edit = parseOrderEditRequest(await request.json().catch(() => ({})));

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.shopOrder.findUnique({
        where: { id },
        include: { items: true, monobankPayment: { select: { id: true } } },
      });
      if (!order) throw new OrderEditError("ORDER_NOT_FOUND", "Замовлення не знайдено.", 404);
      if (order.updatedAt.toISOString() !== edit.expectedUpdatedAt)
        throw new OrderEditError(
          "ORDER_CHANGED",
          "Замовлення щойно змінилося (оплата, статус або інший менеджер). Оновіть сторінку й внесіть зміни ще раз.",
          409
        );
      if (order.isDraft)
        throw new OrderEditError(
          "DRAFT",
          "Це чернетка пропозиції — редагуйте її на сторінці чернеток.",
          409
        );

      const lines: string[] = [];
      const data: Prisma.ShopOrderUpdateManyMutationInput = {};

      if (edit.contact) {
        const changes = describeContactChanges(order, edit.contact);
        if (changes.length) {
          lines.push(...changes);
          data.customerName = edit.contact.customerName;
          data.email = edit.contact.email;
          data.phone = edit.contact.phone;
        }
      }

      if (edit.shippingAddress) {
        const { address, changed } = mergeOrderAddress(order.shippingAddress, edit.shippingAddress);
        if (changed) {
          lines.push(
            `адреса «${orderAddressText(order.shippingAddress) || "—"}» → «${orderAddressText(address) || "—"}»`
          );
          data.shippingAddress = address as Prisma.InputJsonValue;
        }
      }

      let plan: ReturnType<typeof planOrderItemsEdit> | null = null;
      let added: Array<OrderItemAdd & { productSlug: string }> = [];
      if (edit.items) {
        const lock = orderAmountLock(order);
        if (lock) throw new OrderEditError(lock.code, lock.text, 409);
        const candidate = planOrderItemsEdit(
          order.items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            price: Number(item.price),
            total: Number(item.total),
          })),
          edit.items,
          order.currency
        );
        if (candidate.lines.length) {
          plan = candidate;
          // Catalog lines are resolved on the server: slug, SKU and photo come from the product.
          added = await Promise.all(
            plan.add.map(async (line) => {
              if (!line.variantId && !line.productId)
                return { ...line, productSlug: `admin-${randomUUID()}` };
              const variant = line.variantId
                ? await tx.shopProductVariant.findUnique({
                    where: { id: line.variantId },
                    select: {
                      id: true,
                      sku: true,
                      image: true,
                      product: { select: { id: true, slug: true, image: true } },
                    },
                  })
                : null;
              const product =
                variant?.product ??
                (line.productId
                  ? await tx.shopProduct.findUnique({
                      where: { id: line.productId },
                      select: { id: true, slug: true, image: true },
                    })
                  : null);
              if (!product)
                throw new OrderEditError(
                  "PRODUCT_NOT_FOUND",
                  `Товар «${line.title}» не знайдено в каталозі. Оновіть пошук.`,
                  409
                );
              return {
                ...line,
                productId: product.id,
                variantId: variant?.id ?? null,
                productSlug: product.slug,
                sku: variant?.sku ?? line.sku,
                image: variant?.image || product.image || line.image,
              };
            })
          );
          const subtotal = round2(Number(order.subtotal) + plan.delta);
          const total = round2(Number(order.total) + plan.delta);
          if (subtotal < 0 || total <= 0)
            throw new OrderEditError("INVALID_TOTAL", "Сума замовлення має бути більшою за нуль.");
          data.subtotal = subtotal;
          data.total = total;
          lines.push(
            `сума ${formatOrderMoney(Number(order.total), order.currency)} → ${formatOrderMoney(total, order.currency)}`
          );
          if (added.length)
            data.pricingSnapshot = appendOrderSnapshotItems(
              order.pricingSnapshot,
              added,
              order.currency
            ) as Prisma.InputJsonValue;
        }
      }

      if (!lines.length) throw new OrderEditError("NOTHING_CHANGED", "Змін немає — нічого зберігати.");

      // The amount guards are repeated in the claim: a payment that lands between the
      // read and this write makes the update miss instead of changing a paid order.
      const claimed = await tx.shopOrder.updateMany({
        where: {
          id,
          updatedAt: order.updatedAt,
          ...(plan
            ? {
                paymentStatus: order.paymentStatus,
                amountPaid: 0,
                total: order.total,
                stripeCheckoutSessionId: null,
                monobankPayment: { is: null },
              }
            : {}),
        },
        data,
      });
      if (claimed.count !== 1)
        throw new OrderEditError(
          "ORDER_CHANGED",
          "Замовлення щойно змінилося (оплата, статус або інший менеджер). Оновіть сторінку й внесіть зміни ще раз.",
          409
        );

      if (plan) {
        for (const line of plan.update)
          await tx.shopOrderItem.update({
            where: { id: line.id },
            data: {
              quantity: line.quantity,
              price: line.price,
              total: round2(line.price * line.quantity),
            },
          });
        if (plan.remove.length)
          await tx.shopOrderItem.deleteMany({ where: { orderId: id, id: { in: plan.remove } } });
        for (const line of added)
          await tx.shopOrderItem.create({
            data: {
              orderId: id,
              productId: line.productId,
              variantId: line.variantId,
              productSlug: line.productSlug,
              title: line.title,
              image: line.image,
              quantity: line.quantity,
              price: line.price,
              total: round2(line.price * line.quantity),
            },
          });
      }

      await tx.shopOrderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "admin",
          actorName: session.name,
          note: `Замовлення змінено: ${lines.join("; ")}.${edit.note ? ` Коментар: ${edit.note}` : ""}`,
        },
      });
      return { lines };
    });

    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: "order.edit",
      entityType: "shop.order",
      entityId: id,
      metadata: { changes: result.lines, note: edit.note || null },
    });

    return NextResponse.json({ ok: true, changes: result.lines });
  } catch (error) {
    if (error instanceof OrderEditError)
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    if ((error as Error).message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((error as Error).message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin shop order edit", error);
    return NextResponse.json(
      { error: "ORDER_EDIT_FAILED", message: "Не вдалося зберегти зміни. Спробуйте ще раз." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
