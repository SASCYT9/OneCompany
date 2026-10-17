import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Abandoned-cart reminders. The buyer opts in at checkout (per cart); a day after the
 * cart's last activity, if no order followed, one email goes out — in Kyiv daytime,
 * never to an address that unsubscribed. Every attempt lands in ShopEmailSendLog.
 */

export const CART_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
/** Older carts are not worth a reminder any more. */
export const CART_REMINDER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CART_REMINDER_BATCH = 25;
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 21;

export type CartReminderOutcome =
  | "SENT"
  | "ORDERED"
  | "EMPTY"
  | "EXPIRED"
  | "UNSUBSCRIBED"
  | "FAILED";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeReminderEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function kyivHour(now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now)
  );
}

/** Reminders go out 09:00–21:00 Kyiv time; a run at night sends nothing and waits. */
export function isCartReminderSendWindow(now: Date) {
  const hour = kyivHour(now);
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

export function newCartReminderToken() {
  return randomBytes(24).toString("base64url");
}

/** Checkout opt-in (or opt-out) for the buyer's current cart. */
export async function saveCartReminderConsent(
  prisma: PrismaClient,
  input: {
    cartId: string;
    email: string | null;
    consent: boolean;
    firstName?: string | null;
    locale: "ua" | "en";
    currency: string;
    country?: string | null;
    now?: Date;
  }
) {
  if (!input.consent || !input.email) {
    // A sent reminder keeps its row: its links (cart, unsubscribe) must keep working.
    await prisma.shopCartReminder.deleteMany({ where: { cartId: input.cartId, handledAt: null } });
    return { saved: false };
  }
  const now = input.now ?? new Date();
  const details = {
    email: input.email,
    firstName: input.firstName?.trim().slice(0, 80) || null,
    locale: input.locale,
    currency: input.currency,
    country: input.country?.trim().slice(0, 80) || null,
    consentAt: now,
  };
  const existing = await prisma.shopCartReminder.findUnique({
    where: { cartId: input.cartId },
    select: { outcome: true },
  });
  await prisma.shopCartReminder.upsert({
    where: { cartId: input.cartId },
    create: { cartId: input.cartId, token: newCartReminderToken(), ...details },
    // One reminder per cart: once it went out, a renewed opt-in does not queue another.
    update: existing?.outcome === "SENT" ? details : { ...details, handledAt: null, outcome: null },
  });
  return { saved: true };
}

/** Unsubscribe link (GET or one-click POST): the address never gets a reminder again. */
export async function unsubscribeCartReminders(
  prisma: PrismaClient,
  token: string,
  now = new Date()
) {
  if (!token) return null;
  const reminder = await prisma.shopCartReminder.findUnique({
    where: { token },
    select: { email: true, locale: true },
  });
  if (!reminder) return null;
  await prisma.$transaction([
    prisma.shopEmailSuppression.upsert({
      where: { email: reminder.email },
      create: { email: reminder.email, source: "cart_reminder" },
      update: {},
    }),
    prisma.shopCartReminder.updateMany({
      where: { email: reminder.email, handledAt: null },
      data: { handledAt: now, outcome: "UNSUBSCRIBED" },
    }),
  ]);
  return reminder;
}

const dueReminderInclude = {
  cart: { include: { items: { orderBy: { createdAt: "asc" } }, customer: true } },
} satisfies Prisma.ShopCartReminderInclude;

export type DueCartReminder = Prisma.ShopCartReminderGetPayload<{
  include: typeof dueReminderInclude;
}>;

/** Sends one reminder; returns the provider's email id. Throw "EMPTY" if nothing is left to show. */
export type CartReminderSender = (reminder: DueCartReminder) => Promise<string | null>;

export async function runCartReminders(
  prisma: PrismaClient,
  options: { send: CartReminderSender; now?: Date; dryRun?: boolean; batch?: number }
) {
  const now = options.now ?? new Date();
  const result = {
    window: isCartReminderSendWindow(now),
    considered: 0,
    outcomes: {} as Partial<Record<CartReminderOutcome, number>>,
  };
  if (!result.window) return result;

  const dueBefore = new Date(now.getTime() - CART_REMINDER_DELAY_MS);
  const oldestActivity = new Date(now.getTime() - CART_REMINDER_MAX_AGE_MS);
  // A cart counts as abandoned once neither it, its items nor the opt-in moved for a day.
  const due = await prisma.shopCartReminder.findMany({
    where: {
      handledAt: null,
      consentAt: { lte: dueBefore },
      updatedAt: { lte: dueBefore },
      cart: { updatedAt: { lte: dueBefore }, items: { none: { updatedAt: { gt: dueBefore } } } },
    },
    include: dueReminderInclude,
    orderBy: { consentAt: "asc" },
    take: options.batch ?? CART_REMINDER_BATCH,
  });

  for (const reminder of due) {
    result.considered += 1;
    const lastActivity = Math.max(
      reminder.consentAt.getTime(),
      reminder.updatedAt.getTime(),
      reminder.cart.updatedAt.getTime(),
      ...reminder.cart.items.map((item) => item.updatedAt.getTime())
    );
    let outcome: CartReminderOutcome | null = null;
    if (lastActivity < oldestActivity.getTime()) outcome = "EXPIRED";
    else if (!reminder.cart.items.length) outcome = "EMPTY";
    else if (await prisma.shopEmailSuppression.findUnique({ where: { email: reminder.email } }))
      outcome = "UNSUBSCRIBED";
    else if (
      await prisma.shopOrder.count({
        where: {
          createdAt: { gte: reminder.consentAt },
          OR: [
            { email: { equals: reminder.email, mode: "insensitive" } },
            ...(reminder.cart.customerId ? [{ customerId: reminder.cart.customerId }] : []),
          ],
        },
      })
    )
      outcome = "ORDERED";

    if (options.dryRun) {
      const planned = outcome ?? "SENT";
      result.outcomes[planned] = (result.outcomes[planned] ?? 0) + 1;
      continue;
    }

    // Claim first: two overlapping runs can never both send for one cart.
    const claimed = await prisma.shopCartReminder.updateMany({
      where: { cartId: reminder.cartId, handledAt: null },
      data: { handledAt: now, outcome: outcome ?? "SENDING" },
    });
    if (claimed.count !== 1) continue;

    let resendId: string | null = null;
    let error: string | null = null;
    if (!outcome) {
      try {
        resendId = await options.send(reminder);
        outcome = "SENT";
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        outcome = message === "EMPTY" ? "EMPTY" : "FAILED";
        error = outcome === "FAILED" ? message.slice(0, 500) : null;
      }
      await prisma.shopCartReminder.update({
        where: { cartId: reminder.cartId },
        data: { outcome },
      });
    }
    result.outcomes[outcome] = (result.outcomes[outcome] ?? 0) + 1;

    await prisma.shopEmailSendLog.create({
      data: {
        trigger: "CART_ABANDONED_24H",
        recipient: reminder.email,
        subject: reminder.locale === "en" ? "You left items in your cart" : "Ви залишили товари в кошику",
        templateKey: "cart-reminder",
        entityType: "shop.cart",
        entityId: reminder.cartId,
        status: outcome === "SENT" ? "SENT" : outcome === "FAILED" ? "FAILED" : "SKIPPED",
        errorMessage: error,
        sentAt: outcome === "SENT" ? now : null,
        metadata: { outcome, ...(resendId ? { resendId } : {}) },
      },
    });
  }
  return result;
}
