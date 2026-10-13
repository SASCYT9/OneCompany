import {
  OpsPriority,
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  OrderStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { OWNER_ROLE_KEY, SUPERADMIN_ROLE_KEY } from "@/lib/admin/adminPermissions";
import { opsAdminLink } from "@/lib/operations/adminLinks";
import { createOpsExternalId } from "@/lib/operations/ids";
import {
  addOpsLocalDays,
  OPS_OPEN_TASK_WHERE,
  opsLocalClock,
  opsLocalTime,
} from "@/lib/operations/reminders";

/**
 * Shop orders that need a person turn into tasks automatically:
 * - paid but not shipped (no TTN) a day after the order;
 * - still unpaid three days after the order.
 * Only recent orders are considered, so the old backlog is never flooded in.
 * When the order moves on (shipped, paid, cancelled) the task closes itself.
 */
export const OPS_SHOP_TASK_SOURCE_PREFIX = "shop:order:";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const OPS_SHOP_PAID_NOT_SHIPPED = { minAgeMs: DAY_MS, maxAgeMs: 30 * DAY_MS } as const;
export const OPS_SHOP_UNPAID = { minAgeMs: 3 * DAY_MS, maxAgeMs: 10 * DAY_MS } as const;

type ShopRule = "paid-not-shipped" | "unpaid";

const OPEN_ORDER_STATUSES = [
  OrderStatus.PENDING_REVIEW,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerName: true,
  phone: true,
  total: true,
  currency: true,
  paymentMethod: true,
  createdAt: true,
} as const;

type OrderRow = Prisma.ShopOrderGetPayload<{ select: typeof ORDER_SELECT }>;

export function opsShopTaskSourceKey(orderId: string, rule: ShopRule) {
  return `${OPS_SHOP_TASK_SOURCE_PREFIX}${orderId}:${rule}`;
}

function ruleFromSourceKey(sourceKey: string | null): ShopRule | null {
  const rule = String(sourceKey ?? "").split(":")[3];
  return rule === "paid-not-shipped" || rule === "unpaid" ? rule : null;
}

/** Closed by itself once the order no longer needs this action. */
export function isOpsShopTaskResolved(
  rule: ShopRule,
  order: {
    status: OrderStatus;
    paymentStatus: string;
    ttnNumber: string | null;
    shipments: number;
  } | null
) {
  if (!order) return true;
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) return true;
  const shipped =
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED ||
    Boolean(order.ttnNumber?.trim()) ||
    order.shipments > 0;
  if (rule === "paid-not-shipped") return shipped;
  return shipped || order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_PAID";
}

function shopTaskDeadline(rule: ShopRule, now: Date, timeZone = "Europe/Kyiv") {
  const clock = opsLocalClock(now, timeZone);
  // Paid orders: today 18:00 if there is still time, otherwise tomorrow.
  const date =
    rule === "paid-not-shipped" && clock.hour < 16 ? clock.date : addOpsLocalDays(clock.date, 1);
  return opsLocalTime(date, 18, timeZone);
}

function money(value: Prisma.Decimal | number, currency: string) {
  const amount = Number(value);
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
}

export function buildOpsShopTaskDraft(rule: ShopRule, order: OrderRow) {
  const created = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "short",
  }).format(order.createdAt);
  const facts = [
    `Клиент: ${order.customerName}${order.phone ? `, ${order.phone}` : ""}`,
    `Сумма: ${money(order.total, order.currency)}`,
    `Оплата: ${order.paymentMethod}`,
    `Заказ создан: ${created}`,
    `Заказ в админке: ${opsAdminLink(`/admin/shop/orders/${order.id}`)}`,
  ].join("\n");
  if (rule === "paid-not-shipped") {
    return {
      title: `Отправить заказ ${order.orderNumber}: оплачен, ТТН нет`,
      description: `Заказ оплачен, но не отправлен.\n\n${facts}`,
      nextAction: "Проверить наличие, отправить и внести ТТН в заказ.",
      definitionOfDone: "В заказе есть ТТН или статус «Отправлен».",
      priority: OpsPriority.HIGH,
    };
  }
  return {
    title: `Заказ ${order.orderNumber} не оплачен 3+ дня: напомнить или закрыть`,
    description: `Клиент оформил заказ, но не оплатил.\n\n${facts}`,
    nextAction: "Связаться с клиентом: напомнить об оплате или уточнить, актуален ли заказ.",
    definitionOfDone: "Заказ оплачен или отменён.",
    priority: OpsPriority.NORMAL,
  };
}

/** The account that "creates" automatic tasks: the owner most active in the admin. */
async function findOpsSystemActor(client: PrismaClient) {
  const owner = await client.adminUser.findFirst({
    where: {
      isActive: true,
      roles: { some: { role: { key: { in: [OWNER_ROLE_KEY, SUPERADMIN_ROLE_KEY] } } } },
    },
    orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    select: { id: true },
  });
  return owner?.id ?? null;
}

export async function syncOpsShopOrderTasks(input: {
  client: PrismaClient;
  now: Date;
  env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const result = { created: 0, resolved: 0, disabled: false };
  if (/^(0|false|off|no)$/i.test(String(env.OPS_SHOP_TASKS_ENABLED ?? "").trim())) {
    return { ...result, disabled: true };
  }
  const actorId = await findOpsSystemActor(input.client);
  if (!actorId) return result;

  const openTasks = await input.client.opsTask.findMany({
    where: {
      ...OPS_OPEN_TASK_WHERE,
      sourceType: OpsTaskSourceType.AUTOMATION,
      sourceKey: { startsWith: OPS_SHOP_TASK_SOURCE_PREFIX },
    },
    take: 100,
    select: {
      id: true,
      status: true,
      version: true,
      sourceKey: true,
      shopOrder: {
        select: {
          status: true,
          paymentStatus: true,
          ttnNumber: true,
          _count: { select: { shipments: true } },
        },
      },
    },
  });
  for (const task of openTasks) {
    const rule = ruleFromSourceKey(task.sourceKey);
    if (!rule) continue;
    const order = task.shopOrder
      ? {
          status: task.shopOrder.status,
          paymentStatus: task.shopOrder.paymentStatus,
          ttnNumber: task.shopOrder.ttnNumber,
          shipments: task.shopOrder._count.shipments,
        }
      : null;
    if (!isOpsShopTaskResolved(rule, order)) continue;
    const closed = await input.client.$transaction(async (tx) => {
      const changed = await tx.opsTask.updateMany({
        where: { id: task.id, version: task.version, status: task.status },
        data: { status: OpsTaskStatus.DONE, completedAt: input.now, version: { increment: 1 } },
      });
      if (changed.count !== 1) return false;
      await tx.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.STATUS_CHANGED,
          actorId,
          sourceType: OpsTaskSourceType.AUTOMATION,
          sourceId: task.sourceKey,
          idempotencyKey: `shop:resolved:${task.id}`,
          payload: {
            fromStatus: task.status,
            toStatus: OpsTaskStatus.DONE,
            reason: "shop_order_resolved",
          },
        },
      });
      return true;
    });
    if (closed) result.resolved += 1;
  }

  const [paid, unpaid] = await Promise.all([
    input.client.shopOrder.findMany({
      where: {
        isDraft: false,
        paymentStatus: "PAID",
        status: { in: OPEN_ORDER_STATUSES },
        OR: [{ ttnNumber: null }, { ttnNumber: "" }],
        shipments: { none: {} },
        createdAt: {
          gte: new Date(input.now.getTime() - OPS_SHOP_PAID_NOT_SHIPPED.maxAgeMs),
          lte: new Date(input.now.getTime() - OPS_SHOP_PAID_NOT_SHIPPED.minAgeMs),
        },
      },
      take: 20,
      select: ORDER_SELECT,
    }),
    input.client.shopOrder.findMany({
      where: {
        isDraft: false,
        paymentStatus: { in: ["UNPAID", "PENDING"] },
        status: { in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_REVIEW] },
        createdAt: {
          gte: new Date(input.now.getTime() - OPS_SHOP_UNPAID.maxAgeMs),
          lte: new Date(input.now.getTime() - OPS_SHOP_UNPAID.minAgeMs),
        },
      },
      take: 20,
      select: ORDER_SELECT,
    }),
  ]);
  const candidates: Array<[ShopRule, OrderRow]> = [
    ...paid.map((order) => ["paid-not-shipped", order] as [ShopRule, OrderRow]),
    ...unpaid.map((order) => ["unpaid", order] as [ShopRule, OrderRow]),
  ];
  if (!candidates.length) return result;
  const keys = candidates.map(([rule, order]) => opsShopTaskSourceKey(order.id, rule));
  const existing = new Set(
    (
      await input.client.opsTask.findMany({
        where: { sourceKey: { in: keys } },
        select: { sourceKey: true },
      })
    ).map((task) => task.sourceKey)
  );
  for (const [rule, order] of candidates) {
    const sourceKey = opsShopTaskSourceKey(order.id, rule);
    if (existing.has(sourceKey)) continue;
    const draft = buildOpsShopTaskDraft(rule, order);
    try {
      await input.client.$transaction(async (tx) => {
        const task = await tx.opsTask.create({
          data: {
            ...draft,
            externalId: createOpsExternalId("ONE"),
            tags: ["process:order", "source:shop"],
            status: OpsTaskStatus.INBOX,
            dueAt: shopTaskDeadline(rule, input.now),
            shopOrderId: order.id,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: order.id,
            sourceKey,
            createdById: actorId,
          },
          select: { id: true },
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: task.id,
            type: OpsTaskEventType.CREATED,
            actorId,
            sourceType: OpsTaskSourceType.AUTOMATION,
            sourceId: order.id,
            idempotencyKey: sourceKey,
            payload: { rule, orderNumber: order.orderNumber },
          },
        });
      });
      result.created += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return result;
}
