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
  customer: true,
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
    orderNumber: record.orderNumber,
    status: record.status,
    email: record.email,
    customerName: record.customerName,
    customerId: record.customerId,
    customerGroupSnapshot: record.customerGroupSnapshot,
    currency: record.currency,
    total: decimalToNumber(record.total) ?? 0,
    paymentStatus: record.paymentStatus,
    amountPaid: decimalToNumber(record.amountPaid) ?? 0,
    outstandingAmount: Math.max(0, (decimalToNumber(record.total) ?? 0) - (decimalToNumber(record.amountPaid) ?? 0)),
    createdAt: record.createdAt.toISOString(),
    itemCount: record.items.reduce((sum, item) => sum + item.quantity, 0),
    shipmentsCount: record.shipments.length,
    timelineCount: record.events.length,
    latestEvent: record.events[0]
      ? {
          toStatus: record.events[0].toStatus,
          note: record.events[0].note,
          createdAt: record.events[0].createdAt.toISOString(),
        }
      : null,
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
    orderNumber: record.orderNumber,
    status: record.status,
    email: record.email,
    customerName: record.customerName,
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
      let sku: string | null = null;
      let brand: string | null = null;
      let turn14Id: string | null = null;
      let baseCostUsd: number | null = null;
      let markupPct: number | null = null;

      const snap = record.pricingSnapshot as any;
      if (snap?.source === 'turn14_catalog') {
        sku = snap.partNumber || null;
        brand = snap.brandName || null;
        turn14Id = snap.turn14Id || null;
        baseCostUsd = snap.basePrice || null;
        markupPct = snap.markupPct || null;
      } else if (snap?.items) {
        const d = (snap.items as any[]).find((i) => i.slug === item.productSlug);
        if (d?.slug?.startsWith('turn14-')) {
          sku = d.slug.replace('turn14-', '');
          const brandMatch = item.title.match(/\((.*?)\)$/);
          if (brandMatch) brand = brandMatch[1];
        }
      }

      if (!sku && item.productSlug?.startsWith('turn14-')) {
        sku = item.productSlug.replace('turn14-', '');
        const brandMatch = item.title.match(/\((.*?)\)$/);
        if (brandMatch) brand = brandMatch[1];
      }
      
      if (!sku && item.productSlug?.startsWith('crm-')) {
        sku = item.productSlug.replace('crm-', '');
      }

      return {
        id: item.id,
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
      toStatus: 'PENDING_REVIEW',
      actorType: 'system',
      actorName: 'checkout',
      note: 'Order created from storefront checkout.',
    },
  });
}
