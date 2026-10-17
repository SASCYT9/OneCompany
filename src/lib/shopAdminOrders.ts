import { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { serializeAdminShipment } from "@/lib/shopAdminShipments";
import { orderItemSnapshotDetails } from "@/lib/shopOrderPresentation";
import {
  adminMonobankBlockReason,
  adminMonobankCanReplaceProvider,
  monobankCurrencyBlockReason,
} from "./shopMonobankEligibility";
import { reusableMonobankLink } from "./shopMonobankPayments";
import { isOrderTransitionAllowed, ORDER_STATUS_TRANSITIONS } from "./admin/orderWorkflow";
import { orderAmountLock } from "./admin/orderEditing";

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PENDING_REVIEW",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = ORDER_STATUS_TRANSITIONS;

export const adminOrderInclude = {
  customer: true,
  items: true,
  shipments: {
    orderBy: [{ createdAt: "desc" }],
  },
  events: {
    orderBy: [{ createdAt: "desc" }],
  },
  monobankPayment: {
    select: { id: true, invoiceId: true, pageUrl: true, status: true, expiresAt: true },
  },
} satisfies Prisma.ShopOrderInclude;

export type AdminShopOrderRecord = Prisma.ShopOrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

type OrderOperationalMetadata = {
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  taxRegionId: string | null;
  taxRegionName: string | null;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function getOrderOperationalMetadata(
  pricingSnapshot: Prisma.JsonValue | null | undefined
): OrderOperationalMetadata {
  const snapshot = asObject(pricingSnapshot);
  const shippingZone = asObject(snapshot?.shippingZone);
  const taxRegion = asObject(snapshot?.taxRegion);

  return {
    shippingZoneId: stringValue(shippingZone?.id),
    shippingZoneName: stringValue(shippingZone?.name),
    taxRegionId: stringValue(taxRegion?.id),
    taxRegionName: stringValue(taxRegion?.name),
  };
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  return isOrderTransitionAllowed(from, to);
}

/** Lean include for the orders list: one page of rows, no full history. */
export const adminOrderListInclude = {
  customer: { select: { companyName: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productSlug: true,
      variantId: true,
      title: true,
      quantity: true,
      image: true,
      total: true,
    },
  },
  events: {
    orderBy: [{ createdAt: "desc" }],
    take: 6,
    select: { createdAt: true, fromStatus: true, toStatus: true },
  },
  monobankPayment: {
    select: { invoiceId: true, pageUrl: true, status: true, expiresAt: true },
  },
  _count: { select: { shipments: true } },
} satisfies Prisma.ShopOrderInclude;

export type AdminShopOrderListRecord = Prisma.ShopOrderGetPayload<{
  include: typeof adminOrderListInclude;
}>;

/** When the order entered its current status (edits do not reset the clock). */
function statusSince(record: AdminShopOrderListRecord) {
  const entered = record.events.find(
    (event) => event.toStatus === record.status && event.fromStatus !== event.toStatus
  );
  return (entered?.createdAt ?? record.createdAt).toISOString();
}

export function serializeAdminOrderListRow(record: AdminShopOrderListRecord) {
  const total = decimalToNumber(record.total) ?? 0;
  const amountPaid = decimalToNumber(record.amountPaid) ?? 0;
  const openLink = reusableMonobankLink(record.monobankPayment);
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    status: record.status,
    statusSince: statusSince(record),
    createdAt: record.createdAt.toISOString(),
    customerName: record.customerName,
    email: record.email,
    phone: record.phone,
    companyName: record.customer?.companyName ?? null,
    customerGroupSnapshot: record.customerGroupSnapshot,
    currency: record.currency,
    total,
    amountPaid,
    outstandingAmount: Math.max(0, total - amountPaid),
    paymentStatus: record.paymentStatus,
    paymentMethod: record.paymentMethod,
    isDraft: record.isDraft,
    ttnNumber: record.ttnNumber,
    shipmentsCount: record._count.shipments,
    itemCount: record.items.reduce((sum, item) => sum + item.quantity, 0),
    items: record.items.slice(0, 3).map((item) => ({
      ...orderItemSnapshotDetails(record.pricingSnapshot, item),
      id: item.id,
      productId: item.productId,
      productSlug: item.productSlug,
      variantId: item.variantId,
      title: item.title,
      quantity: item.quantity,
      image: item.image,
      total: decimalToNumber(item.total) ?? 0,
    })),
    itemLines: record.items.length,
    monobankLink: openLink
      ? { url: openLink, expiresAt: record.monobankPayment?.expiresAt?.toISOString() ?? null }
      : null,
    allowedTransitions: ORDER_TRANSITIONS[record.status],
  };
}

export type AdminOrderListRow = ReturnType<typeof serializeAdminOrderListRow>;

export function serializeAdminOrder(record: AdminShopOrderRecord) {
  const operational = getOrderOperationalMetadata(record.pricingSnapshot);

  return {
    id: record.id,
    orderNumber: record.orderNumber,
    status: record.status,
    email: record.email,
    customerName: record.customerName,
    customerId: record.customerId,
    companyName: record.customer?.companyName ?? null,
    paymentMethod: record.paymentMethod,
    isDraft: record.isDraft,
    // Why items and prices can or cannot be edited (payment taken, link issued, shipped…).
    amountLock: orderAmountLock(record),
    monobankBlockReason: adminMonobankBlockReason(record),
    monobankCanReplaceProvider: adminMonobankCanReplaceProvider(record),
    // The current open link is shown from the database, so it stays available even
    // while Mono itself is slow to answer.
    monobankLink: (() => {
      // A EUR/USD link is withdrawn once delivery moves to Ukraine (hryvnia only).
      if (monobankCurrencyBlockReason(record)) return null;
      const url = reusableMonobankLink(record.monobankPayment);
      return url
        ? { url, expiresAt: record.monobankPayment?.expiresAt?.toISOString() ?? null }
        : null;
    })(),
    phone: record.phone,
    customerGroupSnapshot: record.customerGroupSnapshot,
    b2bDiscountPercent: record.customer?.b2bDiscountPercent || null,
    discountNotes: record.customer?.notes || null,
    shippingAddress: record.shippingAddress,
    currency: record.currency,
    subtotal: decimalToNumber(record.subtotal) ?? 0,
    shippingCost: decimalToNumber(record.shippingCost) ?? 0,
    taxAmount: decimalToNumber(record.taxAmount) ?? 0,
    total: decimalToNumber(record.total) ?? 0,
    paymentStatus: record.paymentStatus,
    amountPaid: decimalToNumber(record.amountPaid) ?? 0,
    deliveryMethod: record.deliveryMethod,
    ttnNumber: record.ttnNumber,
    shippingCalculatedCost: decimalToNumber(record.shippingCalculatedCost),
    pricingSnapshot: record.pricingSnapshot,
    shippingZoneId: operational.shippingZoneId,
    shippingZoneName: operational.shippingZoneName,
    taxRegionId: operational.taxRegionId,
    taxRegionName: operational.taxRegionName,
    viewToken: record.viewToken,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: record.items.map((item) => {
      const snapshotDetails = orderItemSnapshotDetails(record.pricingSnapshot, item);
      let sku: string | null = snapshotDetails.sku;
      let brand: string | null = null;
      let turn14Id: string | null = null;
      let baseCostUsd: number | null = null;
      let markupPct: number | null = null;

      const snap = record.pricingSnapshot as any;
      if (snap?.source === "turn14_catalog") {
        sku = snap.partNumber || null;
        brand = snap.brandName || null;
        turn14Id = snap.turn14Id || null;
        baseCostUsd = snap.basePrice || null;
        markupPct = snap.markupPct || null;
      } else if (snap?.items) {
        const d = (snap.items as any[]).find((i) => i.slug === item.productSlug);
        if (d?.slug?.startsWith("turn14-")) {
          sku = d.slug.replace("turn14-", "");
          const brandMatch = item.title.match(/\((.*?)\)$/);
          if (brandMatch) brand = brandMatch[1];
        }
      }

      if (!sku && item.productSlug?.startsWith("turn14-")) {
        sku = item.productSlug.replace("turn14-", "");
        const brandMatch = item.title.match(/\((.*?)\)$/);
        if (brandMatch) brand = brandMatch[1];
      }

      if (!sku && item.productSlug?.startsWith("crm-")) {
        sku = item.productSlug.replace("crm-", "");
      }

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        variantTitle: snapshotDetails.variantTitle,
        productSlug: item.productSlug,
        title: item.title,
        quantity: item.quantity,
        price: decimalToNumber(item.price) ?? 0,
        total: decimalToNumber(item.total) ?? 0,
        image: item.image,
        sku,
        brand,
        turn14Id,
        baseCostUsd,
        markupPct,
      };
    }),
    shipments: record.shipments.map(serializeAdminShipment),
    events: record.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      actorName: event.actorName,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
    allowedTransitions: ORDER_TRANSITIONS[record.status],
  };
}

export function getCommonAllowedTransitions(statuses: OrderStatus[]) {
  if (!statuses.length) return [] as OrderStatus[];

  return ALL_ORDER_STATUSES.filter((candidate) =>
    statuses.every((status) => canTransitionOrderStatus(status, candidate))
  );
}

export async function createInitialOrderEvent(prisma: PrismaClient, orderId: string) {
  return prisma.shopOrderStatusEvent.create({
    data: {
      orderId,
      fromStatus: null,
      toStatus: "PENDING_REVIEW",
      actorType: "system",
      actorName: "checkout",
      note: "Order created from storefront checkout.",
    },
  });
}
