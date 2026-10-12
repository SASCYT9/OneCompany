/**
 * Order status workflow for the admin: which moves exist, what each status means,
 * and what a manager should do next. Pure — shared by API routes and the UI.
 */

export type OrderStatusCode =
  | "PENDING_REVIEW"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

/** The normal path of an order, left to right. */
export const ORDER_FLOW: OrderStatusCode[] = [
  "PENDING_REVIEW",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

export const ORDER_STATUS_INFO: Record<
  OrderStatusCode,
  { label: string; description: string; tone: "default" | "success" | "warning" | "danger" }
> = {
  PENDING_REVIEW: {
    label: "На перевірці",
    description: "Нове замовлення. Перевірте товари, наявність і контакти клієнта.",
    tone: "warning",
  },
  PENDING_PAYMENT: {
    label: "Очікує оплату",
    description: "Клієнту надіслано рахунок або посилання на оплату. Чекаємо гроші.",
    tone: "warning",
  },
  CONFIRMED: {
    label: "Підтверджено",
    description: "Оплату отримано або умови погоджено. Можна замовляти чи збирати товар.",
    tone: "default",
  },
  PROCESSING: {
    label: "В обробці",
    description: "Товар замовлено в постачальника або збирається на складі.",
    tone: "default",
  },
  SHIPPED: {
    label: "Відправлено",
    description: "Посилку передано перевізнику, вона в дорозі.",
    tone: "default",
  },
  DELIVERED: {
    label: "Доставлено",
    description: "Клієнт отримав замовлення. Роботу завершено.",
    tone: "success",
  },
  CANCELLED: {
    label: "Скасовано",
    description: "Замовлення не виконується.",
    tone: "danger",
  },
  REFUNDED: {
    label: "Повернено",
    description: "Гроші повернуто клієнту.",
    tone: "danger",
  },
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_INFO[status as OrderStatusCode]?.label ?? status.replace(/_/g, " ");
}

export function orderStatusTone(status: string) {
  return ORDER_STATUS_INFO[status as OrderStatusCode]?.tone ?? "default";
}

/**
 * Forward jumps cover work done outside the admin (shipped straight away, an old order
 * that was handed over long ago); back moves and «restore» exist so a mistaken click
 * is never permanent.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusCode, OrderStatusCode[]> = {
  PENDING_REVIEW: ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  PENDING_PAYMENT: ["PENDING_REVIEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  CONFIRMED: ["PENDING_REVIEW", "PENDING_PAYMENT", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  PROCESSING: ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["PROCESSING", "DELIVERED", "CANCELLED", "REFUNDED"],
  DELIVERED: ["SHIPPED", "REFUNDED"],
  CANCELLED: ["PENDING_REVIEW", "CONFIRMED"],
  REFUNDED: ["DELIVERED"],
};

export type OrderStatusMove = "same" | "forward" | "back" | "cancel" | "restore" | "refund";

export function orderStatusMove(from: string, to: string): OrderStatusMove {
  if (from === to) return "same";
  if (to === "CANCELLED") return "cancel";
  if (to === "REFUNDED") return "refund";
  if (from === "CANCELLED") return "restore";
  if (from === "REFUNDED") return "back";
  const fromIndex = ORDER_FLOW.indexOf(from as OrderStatusCode);
  const toIndex = ORDER_FLOW.indexOf(to as OrderStatusCode);
  return toIndex > fromIndex ? "forward" : "back";
}

export function isOrderTransitionAllowed(from: string, to: string) {
  if (from === to) return true;
  return ORDER_STATUS_TRANSITIONS[from as OrderStatusCode]?.includes(to as OrderStatusCode) ?? false;
}

/** Automatic updates (shipment tracking, payment webhooks) may only move an order forward. */
export function canAdvanceOrderStatus(from: string, to: string) {
  return isOrderTransitionAllowed(from, to) && orderStatusMove(from, to) === "forward";
}

/** Corrections and cancellations must say why — the history is the only audit a manager reads. */
export function orderStatusMoveNeedsReason(from: string, to: string) {
  const move = orderStatusMove(from, to);
  return move === "back" || move === "cancel" || move === "restore";
}

type OrderPaymentFacts = {
  status: string;
  amountPaid: number | { toString(): string };
  paymentStatus: string;
  isDraft?: boolean;
};

export function orderHasMoney(order: Pick<OrderPaymentFacts, "amountPaid" | "paymentStatus">) {
  return (
    Number(order.amountPaid) > 0 ||
    ["PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus)
  );
}

export type OrderStatusProblem = "DRAFT" | "TRANSITION_NOT_ALLOWED" | "ORDER_ALREADY_PAID";

export function orderStatusChangeProblem(
  order: OrderPaymentFacts,
  to: string
): OrderStatusProblem | null {
  if (order.isDraft) return "DRAFT";
  if (!isOrderTransitionAllowed(order.status, to)) return "TRANSITION_NOT_ALLOWED";
  // A paid order cannot go back to «waiting for payment» states: mono/Whitepay would
  // offer a second charge from there.
  if (
    order.status !== to &&
    (to === "PENDING_REVIEW" || to === "PENDING_PAYMENT") &&
    orderHasMoney(order)
  )
    return "ORDER_ALREADY_PAID";
  return null;
}

export const ORDER_STATUS_PROBLEM_TEXT: Record<OrderStatusProblem | "REASON_REQUIRED", string> = {
  DRAFT: "Це чернетка пропозиції — керуйте нею на сторінці чернеток.",
  TRANSITION_NOT_ALLOWED: "Такий перехід статусу неможливий.",
  ORDER_ALREADY_PAID:
    "Клієнт уже оплатив замовлення, тому повернути його в «На перевірці» чи «Очікує оплату» не можна.",
  REASON_REQUIRED: "Вкажіть причину — вона потрапить в історію замовлення.",
};

export const ORDER_CANCEL_REASONS = [
  { code: "customer_changed_mind", label: "Клієнт передумав" },
  { code: "fake", label: "Фейкове замовлення / спам" },
  { code: "test", label: "Тестове замовлення" },
  { code: "duplicate", label: "Дубль іншого замовлення" },
  { code: "no_contact", label: "Клієнт не відповідає" },
  { code: "out_of_stock", label: "Немає в наявності / не можемо привезти" },
  { code: "other", label: "Інша причина" },
] as const;

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number]["code"];

export function orderCancelReasonLabel(code: unknown) {
  return ORDER_CANCEL_REASONS.find((reason) => reason.code === code)?.label ?? null;
}

/** The history line written next to a status change. */
export function composeOrderStatusNote(input: {
  from: string;
  to: string;
  reason?: unknown;
  note?: string | null;
}) {
  const note = input.note?.trim() ?? "";
  const move = orderStatusMove(input.from, input.to);
  const reasonLabel = move === "cancel" ? orderCancelReasonLabel(input.reason) : null;
  if (reasonLabel && input.reason !== "other") return note ? `${reasonLabel}. ${note}` : reasonLabel;
  return note || null;
}

/** A cancellation needs a known reason; «other» and all corrections need a written note. */
export function orderStatusReasonMissing(input: {
  from: string;
  to: string;
  reason?: unknown;
  note?: string | null;
}) {
  if (!orderStatusMoveNeedsReason(input.from, input.to)) return false;
  const note = input.note?.trim() ?? "";
  if (orderStatusMove(input.from, input.to) === "cancel") {
    if (input.reason === "other" || !orderCancelReasonLabel(input.reason)) return !note;
    return false;
  }
  return !note;
}

export type OrderNextAction = {
  to: OrderStatusCode;
  label: string;
};

export type OrderNextStep = {
  hint: string;
  primary: OrderNextAction | null;
  secondary: OrderNextAction | null;
  back: OrderNextAction | null;
  canCancel: boolean;
};

/** What the manager should do next — the big button at the top of the order card. */
export function orderNextStep(order: OrderPaymentFacts): OrderNextStep {
  const status = order.status as OrderStatusCode;
  const paid = orderHasMoney(order);
  const allowed = (to: OrderStatusCode) => orderStatusChangeProblem(order, to) === null;
  const pick = (to: OrderStatusCode, label: string): OrderNextAction | null =>
    allowed(to) ? { to, label } : null;

  const flowIndex = ORDER_FLOW.indexOf(status);
  let back: OrderNextAction | null = null;
  for (let index = flowIndex - 1; index >= 0 && flowIndex > 0; index--) {
    const candidate = ORDER_FLOW[index];
    if (allowed(candidate)) {
      back = { to: candidate, label: `Повернути на «${orderStatusLabel(candidate)}»` };
      break;
    }
  }
  const canCancel = allowed("CANCELLED");

  switch (status) {
    case "PENDING_REVIEW":
      return {
        hint: paid
          ? "Оплата вже надійшла. Перевірте замовлення і підтвердіть його."
          : "Перевірте товари й контакти, зв’яжіться з клієнтом. Далі — надішліть рахунок чи посилання на оплату або підтвердіть замовлення.",
        primary: pick("CONFIRMED", "Підтвердити замовлення"),
        secondary: paid ? null : pick("PENDING_PAYMENT", "Рахунок надіслано — чекаємо оплату"),
        back: null,
        canCancel,
      };
    case "PENDING_PAYMENT":
      return {
        hint: "Чекаємо оплату. Оплата через mono підтвердить замовлення сама; переказ на рахунок ФОП позначте вручну.",
        primary: pick("CONFIRMED", paid ? "Підтвердити замовлення" : "Оплату отримано — підтвердити"),
        secondary: null,
        back,
        canCancel,
      };
    case "CONFIRMED":
      return {
        hint: "Замовте товар у постачальника або зберіть його на складі.",
        primary: pick("PROCESSING", "Взяти в роботу"),
        secondary: pick("SHIPPED", "Одразу відправити"),
        back,
        canCancel,
      };
    case "PROCESSING":
      return {
        hint: "Коли передасте посилку перевізнику — позначте відправку й додайте ТТН.",
        primary: pick("SHIPPED", "Відправлено"),
        secondary: null,
        back,
        canCancel,
      };
    case "SHIPPED":
      return {
        hint: "Посилка в дорозі. Коли клієнт її забере — завершіть замовлення.",
        primary: pick("DELIVERED", "Клієнт отримав"),
        secondary: null,
        back,
        canCancel,
      };
    case "DELIVERED":
      return {
        hint: "Замовлення завершене. Якщо клієнт повертає товар — оформіть повернення.",
        primary: null,
        secondary: null,
        back,
        canCancel: false,
      };
    case "CANCELLED":
      return {
        hint: paid
          ? "Замовлення скасоване, але гроші надходили — перевірте, чи їх повернуто."
          : "Замовлення скасоване. Якщо це помилка — відновіть його.",
        primary: paid
          ? pick("CONFIRMED", "Відновити замовлення")
          : pick("PENDING_REVIEW", "Відновити замовлення"),
        secondary: null,
        back: null,
        canCancel: false,
      };
    case "REFUNDED":
      return {
        hint: "Гроші повернуто клієнту. Замовлення закрите.",
        primary: null,
        secondary: null,
        back: pick("DELIVERED", "Повернути на «Доставлено»"),
        canCancel: false,
      };
    default:
      return { hint: "", primary: null, secondary: null, back: null, canCancel: false };
  }
}

/** Orders that still need work but have been sitting untouched for a month. */
export const ORDER_STALE_DAYS = 30;
export const ORDER_STALE_STATUSES: OrderStatusCode[] = ["PENDING_REVIEW", "PENDING_PAYMENT"];

export function isStaleOrder(order: { status: string; createdAt: string | Date }, now = new Date()) {
  return (
    ORDER_STALE_STATUSES.includes(order.status as OrderStatusCode) &&
    now.getTime() - new Date(order.createdAt).getTime() > ORDER_STALE_DAYS * 86_400_000
  );
}

/** Tabs of the orders list, each a set of statuses. */
export const ORDER_LIST_TABS = [
  {
    key: "active",
    label: "Потребують дії",
    statuses: ["PENDING_REVIEW", "PENDING_PAYMENT", "CONFIRMED", "PROCESSING"],
  },
  { key: "new", label: "Нові", statuses: ["PENDING_REVIEW"] },
  { key: "payment", label: "Чекають оплату", statuses: ["PENDING_PAYMENT"] },
  { key: "confirmed", label: "Підтверджені", statuses: ["CONFIRMED"] },
  { key: "processing", label: "В обробці", statuses: ["PROCESSING"] },
  { key: "shipped", label: "Відправлені", statuses: ["SHIPPED"] },
  { key: "done", label: "Завершені", statuses: ["DELIVERED", "REFUNDED"] },
  { key: "cancelled", label: "Скасовані", statuses: ["CANCELLED"] },
  { key: "all", label: "Усі", statuses: [] },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: OrderStatusCode[] }>;

export type OrderListTab = (typeof ORDER_LIST_TABS)[number]["key"];

export function orderListTab(key: string | null | undefined) {
  return ORDER_LIST_TABS.find((tab) => tab.key === key) ?? ORDER_LIST_TABS[0];
}
