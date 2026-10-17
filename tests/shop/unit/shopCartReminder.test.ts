import assert from "node:assert/strict";
import test from "node:test";
import { render } from "@react-email/render";
import AbandonedCartEmail from "../../../src/components/emails/AbandonedCartEmail";
import {
  CART_REMINDER_DELAY_MS,
  cartReminderState,
  isCartReminderSendWindow,
  normalizeReminderEmail,
  runCartReminders,
  saveCartReminderConsent,
  unsubscribeCartReminders,
} from "../../../src/lib/shopCartReminder";

const NOON_KYIV = new Date("2026-10-17T09:00:00.000Z"); // 12:00 in Kyiv (UTC+3)
const DAY = 24 * 60 * 60 * 1000;

test("reminder emails are validated and normalized", () => {
  assert.equal(normalizeReminderEmail("  Buyer@Example.COM "), "buyer@example.com");
  for (const bad of ["", "buyer", "buyer@", "@example.com", "a b@example.com", 42, null])
    assert.equal(normalizeReminderEmail(bad), null);
});

test("reminders go out 09:00–21:00 Kyiv time only", () => {
  assert.equal(isCartReminderSendWindow(new Date("2026-10-17T05:59:00Z")), false); // 08:59
  assert.equal(isCartReminderSendWindow(new Date("2026-10-17T06:00:00Z")), true); // 09:00
  assert.equal(isCartReminderSendWindow(new Date("2026-10-17T17:59:00Z")), true); // 20:59
  assert.equal(isCartReminderSendWindow(new Date("2026-10-17T18:00:00Z")), false); // 21:00
});

function reminder(id: string, patch: { email?: string; items?: number; age?: number; customerId?: string } = {}) {
  const at = new Date(NOON_KYIV.getTime() - (patch.age ?? DAY + 60_000));
  return {
    cartId: id,
    email: patch.email ?? `${id}@example.com`,
    firstName: null,
    locale: "ua",
    currency: "UAH",
    country: "Ukraine",
    token: `token-${id}`,
    consentAt: at,
    updatedAt: at,
    handledAt: null,
    outcome: null,
    createdAt: at,
    cart: {
      id,
      token: `cart-${id}`,
      customerId: patch.customerId ?? null,
      updatedAt: at,
      customer: null,
      items: Array.from({ length: patch.items ?? 1 }, (_, index) => ({ id: `${id}-${index}`, updatedAt: at })),
    },
  };
}

function fakeDb(due: ReturnType<typeof reminder>[], options: { suppressed?: string[]; ordered?: string[]; taken?: string[] } = {}) {
  const logs: Array<{ status: string; entityId: string; metadata: Record<string, unknown>; errorMessage: string | null }> = [];
  const outcomes = new Map<string, string>();
  const calls = { findMany: 0, writes: 0 };
  const db = {
    shopCartReminder: {
      findMany: async () => {
        calls.findMany += 1;
        return due;
      },
      updateMany: async ({ where, data }: { where: { cartId: string }; data: { outcome: string } }) => {
        calls.writes += 1;
        if (options.taken?.includes(where.cartId)) return { count: 0 };
        outcomes.set(where.cartId, data.outcome);
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { cartId: string }; data: { outcome: string } }) => {
        calls.writes += 1;
        outcomes.set(where.cartId, data.outcome);
      },
    },
    shopEmailSuppression: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        options.suppressed?.includes(where.email) ? { email: where.email } : null,
    },
    shopOrder: {
      count: async ({ where }: { where: { OR: Array<{ email?: { equals: string } }> } }) =>
        where.OR.some((entry) => entry.email && options.ordered?.includes(entry.email.equals)) ? 1 : 0,
    },
    shopEmailSendLog: {
      create: async ({ data }: { data: (typeof logs)[number] }) => {
        calls.writes += 1;
        logs.push(data);
      },
    },
  };
  return { db: db as never, logs, outcomes, calls };
}

test("a day after the last activity the buyer gets exactly one reminder", async () => {
  const sent: string[] = [];
  const f = fakeDb([reminder("due")]);
  const result = await runCartReminders(f.db, {
    now: NOON_KYIV,
    send: async (entry) => {
      sent.push(entry.email);
      return "resend-1";
    },
  });
  assert.deepEqual(sent, ["due@example.com"]);
  assert.deepEqual(result.outcomes, { SENT: 1 });
  assert.equal(f.outcomes.get("due"), "SENT");
  assert.equal(f.logs[0].status, "SENT");
  assert.equal(f.logs[0].metadata.resendId, "resend-1");
});

test("unsubscribed, ordered, empty and stale carts are skipped, never emailed", async () => {
  const f = fakeDb(
    [
      reminder("unsubscribed"),
      reminder("ordered"),
      reminder("empty", { items: 0 }),
      reminder("stale", { age: 8 * DAY }),
      reminder("taken"),
    ],
    { suppressed: ["unsubscribed@example.com"], ordered: ["ordered@example.com"], taken: ["taken"] }
  );
  let sends = 0;
  const result = await runCartReminders(f.db, {
    now: NOON_KYIV,
    send: async () => {
      sends += 1;
      return null;
    },
  });
  assert.equal(sends, 0);
  assert.deepEqual(result.outcomes, { UNSUBSCRIBED: 1, ORDERED: 1, EMPTY: 1, EXPIRED: 1 });
  assert.deepEqual(
    f.logs.map((log) => [log.entityId, log.status]),
    [
      ["unsubscribed", "SKIPPED"],
      ["ordered", "SKIPPED"],
      ["empty", "SKIPPED"],
      ["stale", "SKIPPED"],
    ]
  );
});

test("a failed send is recorded once, and an emptied catalog cart counts as empty", async () => {
  const f = fakeDb([reminder("broken"), reminder("gone")]);
  const result = await runCartReminders(f.db, {
    now: NOON_KYIV,
    send: async (entry) => {
      throw new Error(entry.cartId === "gone" ? "EMPTY" : "validation_error: bad key");
    },
  });
  assert.deepEqual(result.outcomes, { FAILED: 1, EMPTY: 1 });
  assert.equal(f.outcomes.get("broken"), "FAILED");
  assert.match(String(f.logs[0].errorMessage), /bad key/);
});

test("nothing is sent at night, and a dry run writes nothing", async () => {
  const night = fakeDb([reminder("due")]);
  const atNight = await runCartReminders(night.db, {
    now: new Date("2026-10-17T20:00:00Z"), // 23:00 Kyiv
    send: async () => assert.fail("no sends at night"),
  });
  assert.equal(atNight.window, false);
  assert.equal(night.calls.findMany, 0);

  const dry = fakeDb([reminder("due"), reminder("empty", { items: 0 })]);
  const preview = await runCartReminders(dry.db, {
    now: NOON_KYIV,
    dryRun: true,
    send: async () => assert.fail("dry run never sends"),
  });
  assert.deepEqual(preview.outcomes, { SENT: 1, EMPTY: 1 });
  assert.equal(dry.calls.writes, 0);
});

test("checkout consent creates a token, withdrawal removes only an unsent reminder", async () => {
  const calls: Array<[string, unknown]> = [];
  let existing: { outcome: string | null } | null = null;
  const db = {
    shopCartReminder: {
      deleteMany: async (args: unknown) => calls.push(["deleteMany", args]),
      findUnique: async () => existing,
      upsert: async (args: unknown) => calls.push(["upsert", args]),
    },
  } as never;
  const base = { cartId: "cart1", locale: "ua" as const, currency: "EUR", country: "Germany", now: NOON_KYIV };

  await saveCartReminderConsent(db, { ...base, email: "buyer@example.com", consent: true, firstName: " Lukas " });
  const created = calls[0][1] as { create: { token: string; firstName: string; consentAt: Date }; update: Record<string, unknown> };
  assert.ok(created.create.token.length >= 30);
  assert.equal(created.create.firstName, "Lukas");
  assert.equal(created.create.consentAt, NOON_KYIV);
  assert.equal(created.update.handledAt, null);

  // Once sent, the row keeps its recipient and token (its email links must stay valid).
  existing = { outcome: "SENT" };
  await saveCartReminderConsent(db, { ...base, email: "someone-else@example.com", consent: true });
  assert.equal(calls.length, 1, "a sent reminder is never rewritten");

  await saveCartReminderConsent(db, { ...base, email: null, consent: false });
  assert.deepEqual(calls[1], ["deleteMany", { where: { cartId: "cart1", handledAt: null } }]);
});

test("checkout can show the consent the server still holds", async () => {
  let row: { email: string; handledAt: Date | null } | null = { email: "buyer@example.com", handledAt: null };
  const db = { shopCartReminder: { findUnique: async () => row } } as never;
  assert.deepEqual(await cartReminderState(db, "cart1"), { consent: true, email: "buyer@example.com" });
  row = { email: "buyer@example.com", handledAt: NOON_KYIV };
  assert.deepEqual(await cartReminderState(db, "cart1"), { consent: false });
  row = null;
  assert.deepEqual(await cartReminderState(db, "cart1"), { consent: false });
});

test("a send cut off mid-run is picked up again, and a run stops inside its time budget", async () => {
  const wheres: unknown[] = [];
  const f = fakeDb([reminder("due")]);
  const db = f.db as unknown as { shopCartReminder: { findMany: (args: { where: unknown }) => Promise<unknown> } };
  const findMany = db.shopCartReminder.findMany;
  db.shopCartReminder.findMany = async (args) => {
    wheres.push(args.where);
    return findMany(args);
  };
  const out = await runCartReminders(f.db, { now: NOON_KYIV, budgetMs: -1, send: async () => assert.fail("over budget") });
  assert.equal(out.considered, 0);
  // Pending rows, plus claims older than 15 minutes still marked SENDING.
  const where = wheres[0] as { OR: Array<{ outcome?: string; handledAt: unknown }> };
  assert.deepEqual(where.OR[1], {
    outcome: "SENDING",
    handledAt: { lt: new Date(NOON_KYIV.getTime() - 15 * 60 * 1000) },
  });
});

test("unsubscribing suppresses the address and closes its pending reminders", async () => {
  const writes: Array<[string, unknown]> = [];
  const db = {
    shopCartReminder: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        where.token === "good" ? { email: "buyer@example.com", locale: "en" } : null,
      updateMany: async (args: unknown) => writes.push(["closed", args]),
    },
    shopEmailSuppression: { upsert: async (args: unknown) => writes.push(["suppressed", args]) },
    $transaction: async (work: Promise<unknown>[]) => Promise.all(work),
  } as never;
  assert.equal(await unsubscribeCartReminders(db, "missing"), null);
  assert.equal(writes.length, 0);
  assert.deepEqual(await unsubscribeCartReminders(db, "good", NOON_KYIV), { email: "buyer@example.com", locale: "en" });
  assert.deepEqual(writes.map(([kind]) => kind), ["suppressed", "closed"]);
  assert.deepEqual((writes[1][1] as { data: unknown }).data, { handledAt: NOON_KYIV, outcome: "UNSUBSCRIBED" });
});

test("the reminder email lists the cart, links back to it and offers unsubscribe", async () => {
  const html = await render(
    AbandonedCartEmail({
      locale: "ua",
      firstName: "Олександр",
      currency: "UAH",
      items: [
        { title: "Akrapovič Evolution", quantity: 1, image: "/images/a.jpg", lineTotal: 48000 },
        { title: "Карбоновий дифузор", quantity: 2, lineTotal: null },
      ],
      cartUrl: "https://onecompany.global/api/shop/cart/reminder/tok",
      unsubscribeUrl: "https://onecompany.global/api/shop/email/unsubscribe?t=tok",
    })
  );
  assert.match(html, /Ви залишили товари в кошику/);
  assert.match(html, /Akrapovič Evolution/);
  assert.match(html, /48\s000\sгрн/);
  assert.match(html, /Ціна за запитом/);
  assert.match(html, /api\/shop\/cart\/reminder\/tok/);
  assert.match(html, /api\/shop\/email\/unsubscribe\?t=tok/);
  assert.match(html, /Відписатися/);
  // A price-on-request item means no misleading total.
  assert.doesNotMatch(html, />Разом</);
  assert.ok(CART_REMINDER_DELAY_MS === DAY);
});
