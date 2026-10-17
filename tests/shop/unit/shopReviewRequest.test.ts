import assert from "node:assert/strict";
import test from "node:test";
import { render } from "@react-email/render";
import ReviewRequestEmail from "../../../src/components/emails/ReviewRequestEmail";
import {
  orderEmailLocale,
  runReviewRequests,
  SHOP_GOOGLE_REVIEW_URL,
  unsubscribeOrderEmails,
} from "../../../src/lib/shopReviewRequest";

const NOON_KYIV = new Date("2026-10-17T09:00:00.000Z");

function order(id: string, patch: Partial<{ email: string; group: string; country: string; locale: string }> = {}) {
  return {
    id,
    orderNumber: `OC-${id}`,
    email: patch.email ?? `${id}@example.com`,
    customerName: "Олександр Приклад",
    viewToken: `view-${id}`,
    shippingAddress: { country: patch.country ?? "Ukraine" },
    customerGroupSnapshot: patch.group ?? "B2C",
    customer: patch.locale ? { preferredLocale: patch.locale, firstName: "Lukas" } : null,
    items: [{ title: "Akrapovič Evolution", image: null }],
  };
}

function fakeDb(orders: ReturnType<typeof order>[], options: { logged?: string[]; suppressed?: string[] } = {}) {
  const logs: Array<{ entityId: string; status: string; recipient: string; subject: string; metadata: Record<string, unknown> }> = [];
  const queries: Array<{ where: { createdAt: { gte: Date; lte: Date } } }> = [];
  const db = {
    shopOrderStatusEvent: {
      findMany: async (args: (typeof queries)[number]) => {
        queries.push(args);
        return orders.map((entry) => ({ orderId: entry.id }));
      },
    },
    shopOrder: { findMany: async () => orders },
    shopEmailSendLog: {
      findMany: async () => (options.logged ?? []).map((entityId) => ({ entityId })),
      create: async ({ data }: { data: (typeof logs)[number] }) => logs.push(data),
    },
    shopEmailSuppression: {
      findMany: async ({ where }: { where: { email: { in: string[] } } }) =>
        where.email.in.filter((email) => options.suppressed?.includes(email)).map((email) => ({ email })),
    },
  };
  return { db: db as never, logs, queries };
}

test("the review email speaks the buyer's language", () => {
  assert.equal(orderEmailLocale({ shippingAddress: { country: "Ukraine" } }), "ua");
  assert.equal(orderEmailLocale({ shippingAddress: { country: "Germany" } }), "en");
  assert.equal(orderEmailLocale({ shippingAddress: { country: "Germany" }, customer: { preferredLocale: "ua" } }), "ua");
  assert.equal(orderEmailLocale({ shippingAddress: null, customer: { preferredLocale: "en" } }), "en");
});

test("a week after delivery each retail order gets one review request", async () => {
  const sent: string[] = [];
  const f = fakeDb(
    [order("retail"), order("dealer", { group: "B2B_APPROVED" }), order("quiet"), order("done"), order("typo", { email: "no-at-sign" })],
    { logged: ["done"], suppressed: ["quiet@example.com"] }
  );
  const result = await runReviewRequests(f.db, {
    now: NOON_KYIV,
    send: async (entry) => {
      sent.push(entry.orderNumber);
      return "resend-9";
    },
  });
  assert.deepEqual(sent, ["OC-retail"]);
  assert.deepEqual(result.outcomes, { SENT: 1, B2B: 1, UNSUBSCRIBED: 1, NO_EMAIL: 1 });
  assert.deepEqual(
    f.logs.map((log) => [log.entityId, log.status]),
    [
      ["retail", "SENT"],
      ["dealer", "SKIPPED"],
      ["quiet", "SKIPPED"],
      ["typo", "SKIPPED"],
    ]
  );
  assert.equal(f.logs[0].subject, "Як вам замовлення OC-retail?");
  // Only deliveries 7–14 days old are looked at (no burst for old orders at launch).
  const window = f.queries[0].where.createdAt;
  assert.equal(NOON_KYIV.getTime() - window.lte.getTime(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(NOON_KYIV.getTime() - window.gte.getTime(), 14 * 24 * 60 * 60 * 1000);
});

test("review requests wait for daytime, dry runs write nothing, failures are logged", async () => {
  const night = fakeDb([order("retail")]);
  const atNight = await runReviewRequests(night.db, {
    now: new Date("2026-10-17T20:30:00Z"),
    send: async () => assert.fail("no sends at night"),
  });
  assert.equal(atNight.window, false);
  assert.equal(night.queries.length, 0);

  const dry = fakeDb([order("retail"), order("dealer", { group: "B2B_APPROVED" })]);
  const preview = await runReviewRequests(dry.db, {
    now: NOON_KYIV,
    dryRun: true,
    send: async () => assert.fail("dry run never sends"),
  });
  assert.deepEqual(preview.outcomes, { SENT: 1, B2B: 1 });
  assert.equal(dry.logs.length, 0);

  const broken = fakeDb([order("retail")]);
  await runReviewRequests(broken.db, {
    now: NOON_KYIV,
    send: async () => {
      throw new Error("rate_limit_exceeded");
    },
  });
  assert.equal(broken.logs[0].status, "FAILED");
});

test("the review email's unsubscribe link needs the order's private token", async () => {
  const suppressed: unknown[] = [];
  const db = {
    shopOrder: {
      findUnique: async ({ where }: { where: { orderNumber: string } }) =>
        where.orderNumber === "OC-1"
          ? { email: " Buyer@Example.com ", viewToken: "view-1", shippingAddress: { country: "Germany" }, customer: null }
          : null,
    },
    shopEmailSuppression: { upsert: async (args: unknown) => suppressed.push(args) },
  } as never;
  assert.equal(await unsubscribeOrderEmails(db, "OC-1", "guess"), null);
  assert.equal(await unsubscribeOrderEmails(db, "OC-2", "view-1"), null);
  assert.equal(suppressed.length, 0);
  assert.deepEqual(await unsubscribeOrderEmails(db, "OC-1", "view-1"), { email: "buyer@example.com", locale: "en" });
  assert.deepEqual((suppressed[0] as { create: unknown }).create, { email: "buyer@example.com", source: "review_request" });
});

test("the review email links to the Google review form and offers unsubscribe", async () => {
  const html = await render(
    ReviewRequestEmail({
      locale: "ua",
      orderNumber: "OC-2026-00099",
      firstName: "Олександр",
      items: [{ title: "Akrapovič Evolution" }],
      reviewUrl: SHOP_GOOGLE_REVIEW_URL,
      unsubscribeUrl: "https://onecompany.global/api/shop/email/unsubscribe?o=OC-2026-00099&t=view",
    })
  );
  assert.match(html, /Як вам замовлення\?/);
  assert.match(html, /OC-2026-00099/);
  assert.match(html, /writereview\?placeid=ChIJlfh2FB7P1EARr1YUx2cdETA/);
  assert.match(html, /unsubscribe\?o=OC-2026-00099&amp;t=view/);
  assert.match(html, /Залишити відгук у Google/);
});
