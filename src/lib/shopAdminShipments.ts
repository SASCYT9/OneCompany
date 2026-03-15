import { OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { canTransitionOrderStatus } from '@/lib/shopAdminOrders';

export const ALL_SHIPMENT_STATUSES: ShipmentStatus[] = [
  'LABEL_CREATED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

export const adminShipmentSelect = {
  id: true,
  orderId: true,
  carrier: true,
  serviceLevel: true,
  trackingNumber: true,
  trackingUrl: true,
  status: true,
  notes: true,
  shippedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShopShipmentSelect;

export type AdminShopShipmentRecord = Prisma.ShopShipmentGetPayload<{
  select: typeof adminShipmentSelect;
}>;

function nullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function nullableDateString(value: unknown) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function normalizeAdminShipmentPayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const status = String(source.status ?? '').trim().toUpperCase();
  const carrier = String(source.carrier ?? '').trim();
  const trackingNumber = String(source.trackingNumber ?? '').trim();

  const errors: string[] = [];
  if (!carrier) errors.push('carrier is required');
  if (!trackingNumber) errors.push('trackingNumber is required');
  if (!ALL_SHIPMENT_STATUSES.includes(status as ShipmentStatus)) {
    errors.push('valid shipment status is required');
  }

  return {
    data: {
      carrier,
      serviceLevel: nullableString(source.serviceLevel),
      trackingNumber,
      trackingUrl: nullableString(source.trackingUrl),
      status: (ALL_SHIPMENT_STATUSES.includes(status as ShipmentStatus)
        ? status
        : 'LABEL_CREATED') as ShipmentStatus,
      notes: nullableString(source.notes),
      shippedAt: nullableDateString(source.shippedAt),
      deliveredAt: nullableDateString(source.deliveredAt),
    },
    errors,
  };
}

export function serializeAdminShipment(record: AdminShopShipmentRecord) {
  return {
    id: record.id,
    orderId: record.orderId,
    carrier: record.carrier,
    serviceLevel: record.serviceLevel,
    trackingNumber: record.trackingNumber,
    trackingUrl: record.trackingUrl,
    status: record.status,
    notes: record.notes,
    shippedAt: record.shippedAt?.toISOString() ?? null,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function deriveOrderStatusFromShipmentStatus(status: ShipmentStatus): OrderStatus | null {
  switch (status) {
    case 'IN_TRANSIT':
      return 'SHIPPED';
    case 'DELIVERED':
      return 'DELIVERED';
    default:
      return null;
  }
}

export async function maybeApplyShipmentOrderStatus(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    currentOrderStatus: OrderStatus;
    shipmentStatus: ShipmentStatus;
    actorName: string;
  }
) {
  const derivedOrderStatus = deriveOrderStatusFromShipmentStatus(input.shipmentStatus);
  if (!derivedOrderStatus) {
    return input.currentOrderStatus;
  }

  if (!canTransitionOrderStatus(input.currentOrderStatus, derivedOrderStatus)) {
    return input.currentOrderStatus;
  }

  if (input.currentOrderStatus === derivedOrderStatus) {
    return input.currentOrderStatus;
  }

  await tx.shopOrder.update({
    where: { id: input.orderId },
    data: { status: derivedOrderStatus },
  });

  await tx.shopOrderStatusEvent.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.currentOrderStatus,
      toStatus: derivedOrderStatus,
      actorType: 'admin',
      actorName: input.actorName,
      note:
        derivedOrderStatus === 'SHIPPED'
          ? 'Order marked as shipped from shipment tracking update.'
          : 'Order marked as delivered from shipment tracking update.',
    },
  });

  return derivedOrderStatus;
}
