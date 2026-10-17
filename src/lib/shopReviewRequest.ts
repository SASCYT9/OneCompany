import type { PrismaClient } from "@prisma/client";
import { isInternationalDelivery } from "./shopInternationalCheckout";
import { isCustomerEmailSendWindow, normalizeReminderEmail } from "./shopCartReminder";

/**
 * Review requests: a week after a manager marks an order «Доставлено», a retail buyer
 * gets one email asking for a Google review. Dealers (B2B) and unsubscribed addresses
 * are skipped; every order is handled once and logged in ShopEmailSendLog.
 */

/** One Company on Google Maps (вул. Басейна, 21Б, Київ) — opens the "write a review" form. */
export const SHOP_GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJlfh2FB7P1EARr1YUx2cdETA";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REVIEW_REQUEST_AFTER_MS = 7 * DAY_MS;
/** Deliveries older than this are not asked any more (also no burst at launch). */
export const REVIEW_REQUEST_UNTIL_MS = 14 * DAY_MS;
export const REVIEW_REQUEST_TEMPLATE_KEY = "review-request";

export type ReviewRequestOutcome = "SENT" | "B2B" | "NO_EMAIL" | "UNSUBSCRIBED" | "FAILED";

const reviewOrderSelect = {
  id: true,
  orderNumber: true,
  email: true,
  customerName: true,
  viewToken: true,
  shippingAddress: true,
  customerGroupSnapshot: true,
  customer: { select: { preferredLocale: true, firstName: true } },
  items: { select: { title: true, image: true }, take: 3 },
} as const;

export type ReviewRequestOrder = {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  viewToken: string;
  shippingAddress: unknown;
  customerGroupSnapshot: string;
  customer: { preferredLocale: string; firstName: string } | null;
  items: Array<{ title: string; image: string | null }>;
};

/** The buyer's language: their account setting, else Ukrainian for delivery in Ukraine. */
export function orderEmailLocale(order: {
  shippingAddress: unknown;
  customer?: { preferredLocale: string } | null;
}): "ua" | "en" {
  if (order.customer?.preferredLocale === "en") return "en";
  if (order.customer?.preferredLocale === "ua") return "ua";
  const address = order.shippingAddress;
  const country =
    address && typeof address === "object" && !Array.isArray(address)
      ? String((address as Record<string, unknown>).country ?? "")
      : "";
  return isInternationalDelivery(country) ? "en" : "ua";
}

/** Sends one review request; returns the provider's email id. */
export type ReviewRequestSender = (order: ReviewRequestOrder) => Promise<string | null>;

export async function runReviewRequests(
  prisma: PrismaClient,
  options: { send: ReviewRequestSender; now?: Date; dryRun?: boolean; batch?: number }
) {
  const now = options.now ?? new Date();
  const result = {
    window: isCustomerEmailSendWindow(now),
    considered: 0,
    outcomes: {} as Partial<Record<ReviewRequestOutcome, number>>,
  };
  if (!result.window) return result;

  const delivered = await prisma.shopOrderStatusEvent.findMany({
    where: {
      toStatus: "DELIVERED",
      createdAt: {
        gte: new Date(now.getTime() - REVIEW_REQUEST_UNTIL_MS),
        lte: new Date(now.getTime() - REVIEW_REQUEST_AFTER_MS),
      },
    },
    select: { orderId: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const ids = [...new Set(delivered.map((event) => event.orderId))];
  if (!ids.length) return result;

  const [orders, handled] = await Promise.all([
    prisma.shopOrder.findMany({
      // Still delivered today: a reopened or returned order is not asked for a review.
      where: { id: { in: ids }, status: "DELIVERED", isDraft: false },
      select: reviewOrderSelect,
    }),
    prisma.shopEmailSendLog.findMany({
      where: {
        templateKey: REVIEW_REQUEST_TEMPLATE_KEY,
        entityType: "shop.order",
        entityId: { in: ids },
      },
      select: { entityId: true },
    }),
  ]);
  const done = new Set(handled.map((log) => log.entityId));
  const pending = (orders as ReviewRequestOrder[])
    .filter((order) => !done.has(order.id))
    .slice(0, options.batch ?? 25);
  const suppressed = new Set(
    (
      await prisma.shopEmailSuppression.findMany({
        where: { email: { in: pending.map((order) => order.email.trim().toLowerCase()) } },
        select: { email: true },
      })
    ).map((entry) => entry.email)
  );

  for (const order of pending) {
    result.considered += 1;
    const email = normalizeReminderEmail(order.email);
    let outcome: ReviewRequestOutcome | null =
      order.customerGroupSnapshot !== "B2C"
        ? "B2B"
        : !email
          ? "NO_EMAIL"
          : suppressed.has(email)
            ? "UNSUBSCRIBED"
            : null;
    if (options.dryRun) {
      const planned = outcome ?? "SENT";
      result.outcomes[planned] = (result.outcomes[planned] ?? 0) + 1;
      continue;
    }
    let resendId: string | null = null;
    let error: string | null = null;
    if (!outcome) {
      try {
        resendId = await options.send(order);
        outcome = "SENT";
      } catch (reason) {
        outcome = "FAILED";
        error = (reason instanceof Error ? reason.message : String(reason)).slice(0, 500);
      }
    }
    result.outcomes[outcome] = (result.outcomes[outcome] ?? 0) + 1;
    const locale = orderEmailLocale(order);
    // The log row is also the "already handled" mark for this order.
    await prisma.shopEmailSendLog.create({
      data: {
        trigger: "ORDER_DELIVERED",
        recipient: email ?? order.email,
        subject:
          locale === "en" ? `How was your order ${order.orderNumber}?` : `Як вам замовлення ${order.orderNumber}?`,
        templateKey: REVIEW_REQUEST_TEMPLATE_KEY,
        entityType: "shop.order",
        entityId: order.id,
        status: outcome === "SENT" ? "SENT" : outcome === "FAILED" ? "FAILED" : "SKIPPED",
        errorMessage: error,
        sentAt: outcome === "SENT" ? now : null,
        metadata: { outcome, ...(resendId ? { resendId } : {}) },
      },
    });
  }
  return result;
}

/** Unsubscribe link of an order email (order number + its private view token). */
export async function unsubscribeOrderEmails(prisma: PrismaClient, orderNumber: string, token: string) {
  if (!orderNumber || !token) return null;
  const order = await prisma.shopOrder.findUnique({
    where: { orderNumber },
    select: {
      email: true,
      viewToken: true,
      shippingAddress: true,
      customer: { select: { preferredLocale: true } },
    },
  });
  const email = order && order.viewToken === token ? normalizeReminderEmail(order.email) : null;
  if (!order || !email) return null;
  await prisma.shopEmailSuppression.upsert({
    where: { email },
    create: { email, source: "review_request" },
    update: {},
  });
  return { email, locale: orderEmailLocale(order) };
}
