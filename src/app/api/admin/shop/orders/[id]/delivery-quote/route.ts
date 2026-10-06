import { isShopSourcePriceBook } from "@/lib/shopPriceBookCurrency";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import {
  calculateInternationalDeliveryQuote,
  snapshotRecord,
} from "@/lib/shopInternationalDeliveryQuote";
import { monobankMinorUnits } from "@/lib/shopMonobank";
import {
  getAgreedInternationalShippingSource,
  internationalDeliveryAgreementMatches,
} from "@/lib/shopInternationalCheckout";
import type { ShopCurrencyRates } from "@/lib/shopMoneyFormat";

async function loadQuote(id: string, shipping: unknown, shippingCurrency: unknown = "UAH") {
  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: { items: true, monobankPayment: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (
    order.paymentMethod !== "MANAGER_QUOTE" ||
    order.amountPaid > 0 ||
    order.paymentStatus !== "UNPAID" ||
    !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status) ||
    order.monobankPayment?.invoiceId
  )
    throw new Error("ORDER_QUOTE_NOT_EDITABLE");
  const settings = getShopSettingsRuntime(await getOrCreateShopSettings(prisma));
  const source = getAgreedInternationalShippingSource(order.pricingSnapshot);
  const storedRates = snapshotRecord(snapshotRecord(order.pricingSnapshot).currencyRates);
  const savedRates: ShopCurrencyRates = {
    EUR: Number(storedRates.EUR),
    USD: Number(storedRates.USD),
    UAH: Number(storedRates.UAH),
    ...(isShopSourcePriceBook(storedRates)
      ? {
          _uahReserve: Number(storedRates._uahReserve),
          ...(Number(storedRates._rawUsdToUah) > 0
            ? { _rawUsdToUah: Number(storedRates._rawUsdToUah) }
            : {}),
          ...(storedRates._manualCross === 1 ? { _manualCross: 1 } : {}),
        }
      : {}),
  };
  // An unchanged agreed amount keeps its saved rate. Editing the source amount
  // or currency starts a fresh calculation and requires a new agreement.
  const ratesLocked = Boolean(
    source &&
      source.currency === shippingCurrency &&
      source.amount === Number(shipping) &&
      internationalDeliveryAgreementMatches(order.pricingSnapshot, order.currency, order.total) &&
      (["EUR", "USD", "UAH"] as const).every(
        (key) => Number.isFinite(savedRates[key]) && savedRates[key] > 0
      )
  );
  return {
    order,
    quote: {
      ...calculateInternationalDeliveryQuote(
        order,
        ratesLocked ? savedRates : settings.currencyRates,
        shipping,
        undefined,
        shippingCurrency
      ),
      ratesLocked,
    },
  };
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "DELIVERY_QUOTE_FAILED";
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const { id } = await params;
    const query = request.nextUrl.searchParams;
    const currency = query.get("shippingCurrency") ?? "UAH";
    if (!query.has("shippingAmount") && currency !== "UAH")
      throw new Error("DELIVERY_SHIPPING_AMOUNT_REQUIRED");
    const { quote } = await loadQuote(
      id,
      query.get("shippingAmount") ?? query.get("shippingCostUah") ?? "0",
      currency
    );
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;
    const body = await request.json();
    if (body.customerAgreed !== true) throw new Error("CUSTOMER_AGREEMENT_REQUIRED");
    const shippingCurrency = body.shippingCurrency ?? "UAH";
    const hasShippingAmount = Object.prototype.hasOwnProperty.call(body, "shippingAmount");
    if (!hasShippingAmount && shippingCurrency !== "UAH")
      throw new Error("DELIVERY_SHIPPING_AMOUNT_REQUIRED");
    const { order, quote } = await loadQuote(
      id,
      hasShippingAmount ? body.shippingAmount : body.shippingCostUah,
      shippingCurrency
    );
    if (
      typeof body.expectedTotalUah !== "number" ||
      monobankMinorUnits(body.expectedTotalUah) !== monobankMinorUnits(quote.total)
    )
      throw new Error("DELIVERY_QUOTE_CHANGED");
    if (
      (shippingCurrency !== "UAH" || body.expectedShippingCostUah !== undefined) &&
      (typeof body.expectedShippingCostUah !== "number" ||
        monobankMinorUnits(body.expectedShippingCostUah) !== monobankMinorUnits(quote.shippingCost))
    )
      throw new Error("DELIVERY_QUOTE_CHANGED");
    const snapshot = snapshotRecord(order.pricingSnapshot);
    const previous = snapshotRecord(snapshot.internationalDelivery);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.shopOrder.updateMany({
        where: {
          id,
          updatedAt: order.updatedAt,
          paymentMethod: "MANAGER_QUOTE",
          paymentStatus: "UNPAID",
          amountPaid: 0,
        },
        data: {
          currency: "UAH",
          subtotal: quote.subtotal,
          shippingCost: quote.shippingCost,
          shippingCalculatedCost: quote.shippingCost,
          taxAmount: quote.taxAmount,
          total: quote.total,
          pricingSnapshot: JSON.parse(
            JSON.stringify({
              ...snapshot,
              originalPricingSnapshot: snapshot.originalPricingSnapshot ?? snapshot,
              currency: "UAH",
              currencyRates: quote.currencyRates,
              subtotal: quote.subtotal,
              shippingCost: quote.shippingCost,
              taxAmount: quote.taxAmount,
              taxableSubtotal: quote.taxableSubtotal,
              taxableShippingCost: quote.taxableShippingCost,
              total: quote.total,
              items: order.items.map((item) => {
                const quoted = quote.items.find((line) => line.id === item.id)!;
                const original = Array.isArray(snapshot.items)
                  ? snapshot.items.find((line) => {
                      const record = snapshotRecord(line);
                      return (
                        record.slug === item.productSlug &&
                        (record.variantId ?? null) === item.variantId
                      );
                    })
                  : {};
                return {
                  ...snapshotRecord(original),
                  slug: item.productSlug,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: quoted.price,
                  total: quoted.total,
                  currency: "UAH",
                };
              }),
              regionalAdjustmentAmount: quote.regionalAdjustmentAmount,
              internationalDelivery: {
                ...previous,
                status: "agreed",
                currency: "UAH",
                total: quote.total,
                shippingCost: quote.shippingCost,
                shippingQuote: quote.shippingQuote,
                taxAmount: quote.taxAmount,
                agreedAt: new Date().toISOString(),
                agreedBy: session.email,
                originalOrder: previous.originalOrder ?? {
                  currency: order.currency,
                  total: Number(order.total),
                  items: order.items.map((item) => ({
                    id: item.id,
                    price: Number(item.price),
                    total: Number(item.total),
                    quantity: item.quantity,
                  })),
                },
              },
            })
          ),
        },
      });
      if (claimed.count !== 1) throw new Error("ORDER_QUOTE_CHANGED");
      for (const item of quote.items)
        await tx.shopOrderItem.update({
          where: { id: item.id },
          data: { price: item.price, total: item.total },
        });
      await writeAdminAuditLog(tx, session, {
        scope: "shop",
        action: "order.international_delivery.agreed",
        entityType: "shop.order",
        entityId: id,
        metadata: {
          currency: "UAH",
          total: quote.total,
          shippingCost: quote.shippingCost,
          shippingQuote: quote.shippingQuote,
          taxAmount: quote.taxAmount,
          customerAgreed: true,
        },
      });
      await tx.shopOrderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "admin",
          actorName: session.name,
          note: `Міжнародну доставку та суму погоджено з клієнтом: ${quote.total} UAH; доставка ${quote.shippingQuote.amount} ${quote.shippingQuote.currency} (${quote.shippingCost} UAH).`,
        },
      });
    });
    return NextResponse.json({ ok: true, currency: "UAH", total: quote.total });
  } catch (error) {
    return failure(error);
  }
}
