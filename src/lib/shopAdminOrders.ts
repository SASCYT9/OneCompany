import { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { serializeAdminShipment } from '@/lib/shopAdminShipments';

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  PENDING_REVIEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export const adminOrderInclude = {
  store: {
    select: {
      key: true,
      name: true,
    },
  },
  items: true,
  shipments: {
    orderBy: [{ createdAt: 'desc' }],
  },
  events: {
    orderBy: [{ createdAt: 'desc' }],
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function getOrderOperationalMetadata(pricingSnapshot: Prisma.JsonValue | null | undefined): OrderOperationalMetadata {
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
  if (from === to) return true;
  return ORDER_TRANSITIONS[from].includes(to);
}

export function serializeAdminOrderSummary(record: AdminShopOrderRecord) {
  const operational = getOrderOperationalMetadata(record.pricingSnapshot);

  return {
    id: record.id,
    storeKey: record.storeKey,
    store: record.store,
    orderNumber: record.orderNumber,
    status: record.status,
    email: record.email,
    customerName: record.customerName,
    currency: record.currency,
    total: decimalToNumber(record.total) ?? 0,
    discountAmount: decimalToNumber(record.discountAmount) ?? 0,
    promotionCode: record.promotionCode,
    createdAt: record.createdAt.toISOString(),
    itemCount: record.items.reduce((sum, item) => sum + item.quantity, 0),
    shipmentsCount: record.shipments.length,
    timelineCount: record.events.length,
    allowedTransitions: ORDER_TRANSITIONS[record.status],
    shippingZoneId: operational.shippingZoneId,
    shippingZoneName: operational.shippingZoneName,
    taxRegionId: operational.taxRegionId,
    taxRegionName: operational.taxRegionName,
  };
}

export function serializeAdminOrder(record: AdminShopOrderRecord) {
  const operational = getOrderOperationalMetadata(record.pricingSnapshot);

  return {
    id: record.id,
    storeKey: record.storeKey,
    store: record.store,
    orderNumber: record.orderNumber,
    status: record.status,
    email: record.email,
    customerName: record.customerName,
    phone: record.phone,
    shippingAddress: record.shippingAddress,
    currency: record.currency,
    subtotal: decimalToNumber(record.subtotal) ?? 0,
    discountAmount: decimalToNumber(record.discountAmount) ?? 0,
    shippingCost: decimalToNumber(record.shippingCost) ?? 0,
    taxAmount: decimalToNumber(record.taxAmount) ?? 0,
    total: decimalToNumber(record.total) ?? 0,
    promotionCode: record.promotionCode,
    promotionSnapshot: record.promotionSnapshot,
    pricingSnapshot: record.pricingSnapshot,
    shippingZoneId: operational.shippingZoneId,
    shippingZoneName: operational.shippingZoneName,
    taxRegionId: operational.taxRegionId,
    taxRegionName: operational.taxRegionName,
    viewToken: record.viewToken,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: record.items.map((item) => ({
      id: item.id,
      productSlug: item.productSlug,
      title: item.title,
      quantity: item.quantity,
      price: decimalToNumber(item.price) ?? 0,
      total: decimalToNumber(item.total) ?? 0,
      image: item.image,
    })),
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

export async function createInitialOrderEvent(
  prisma: PrismaClient,
  orderId: string,
  status: OrderStatus = 'PENDING_REVIEW'
) {
  return prisma.shopOrderStatusEvent.create({
    data: {
      orderId,
      fromStatus: null,
      toStatus: status,
      actorType: 'system',
      actorName: 'checkout',
      note:
        status === 'PENDING_PAYMENT'
          ? 'Order created from storefront checkout and is waiting for payment.'
          : 'Order created from storefront checkout.',
    },
  });
}
