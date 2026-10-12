import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeOrderAddress,
  OrderEditError,
  orderAmountLock,
  parseOrderEditRequest,
  planOrderItemsEdit,
} from "../../../src/lib/admin/orderEditing";

const open = {
  status: "PENDING_REVIEW",
  paymentStatus: "UNPAID",
  paymentMethod: "FOP",
  amountPaid: 0,
  isDraft: false,
  stripeCheckoutSessionId: null,
  monobankPayment: null,
};

test("items and prices stay editable only while no money or payment link exists", () => {
  assert.equal(orderAmountLock(open), null);
  assert.equal(orderAmountLock({ ...open, status: "CONFIRMED" }), null);
  assert.equal(orderAmountLock({ ...open, amountPaid: 10 })?.code, "PAID");
  assert.equal(orderAmountLock({ ...open, paymentStatus: "PARTIALLY_PAID" })?.code, "PAID");
  assert.equal(orderAmountLock({ ...open, monobankPayment: { id: "p" } })?.code, "PAYMENT_LINK");
  assert.equal(orderAmountLock({ ...open, paymentStatus: "PENDING" })?.code, "PAYMENT_LINK");
  assert.equal(orderAmountLock({ ...open, paymentMethod: "WHITEBIT" })?.code, "PAYMENT_LINK");
  assert.equal(orderAmountLock({ ...open, stripeCheckoutSessionId: "cs_1" })?.code, "PAYMENT_LINK");
  assert.equal(orderAmountLock({ ...open, status: "SHIPPED" })?.code, "FULFILLED");
  assert.equal(orderAmountLock({ ...open, status: "CANCELLED" })?.code, "CANCELLED");
  assert.equal(orderAmountLock({ ...open, isDraft: true })?.code, "DRAFT");
});

test("edit requests are validated with messages a manager understands", () => {
  const base = { expectedUpdatedAt: "2026-10-13T10:00:00.000Z" };
  assert.throws(() => parseOrderEditRequest({}), (error: OrderEditError) => error.code === "STALE_FORM");
  assert.throws(
    () => parseOrderEditRequest({ ...base, contact: { customerName: "Іван", email: "not-mail" } }),
    (error: OrderEditError) => error.code === "INVALID_EMAIL"
  );
  assert.throws(
    () => parseOrderEditRequest({ ...base, items: { update: [{ id: "i1", quantity: 0, price: 1 }] } }),
    (error: OrderEditError) => error.code === "INVALID_QUANTITY"
  );
  assert.throws(
    () => parseOrderEditRequest({ ...base, items: { add: [{ title: "x", quantity: 1, price: -5 }] } }),
    (error: OrderEditError) => error.code === "INVALID_PRICE"
  );
  const parsed = parseOrderEditRequest({
    ...base,
    contact: { customerName: " Іван ", email: "IVAN@Example.com ", phone: "" },
    items: { update: [{ id: "i1", quantity: "2", price: "10.005" }] },
  });
  assert.deepEqual(parsed.contact, { customerName: "Іван", email: "ivan@example.com", phone: null });
  assert.deepEqual(parsed.items?.update, [{ id: "i1", quantity: 2, price: 10.01 }]);
});

test("the total moves by the items difference, keeping unchanged lines as charged", () => {
  const current = [
    { id: "a", title: "Вихлоп", quantity: 1, price: 1000, total: 990 },
    { id: "b", title: "Фільтр", quantity: 2, price: 50, total: 100 },
  ];
  const plan = planOrderItemsEdit(
    current,
    {
      update: [
        { id: "a", quantity: 1, price: 1000 },
        { id: "b", quantity: 3, price: 50 },
      ],
      remove: [],
      add: [
        {
          productId: null,
          variantId: null,
          productSlug: null,
          sku: null,
          title: "Монтаж",
          image: null,
          quantity: 1,
          price: 300,
        },
      ],
    },
    "UAH"
  );
  // «a» did not change, so its stored 990 stays; «b» goes 100 → 150; +300 added.
  assert.deepEqual(plan.update, [{ id: "b", quantity: 3, price: 50 }]);
  assert.equal(plan.itemsTotalBefore, 1090);
  assert.equal(plan.itemsTotalAfter, 1440);
  assert.equal(plan.delta, 350);
  assert.equal(plan.lines.length, 2);
  assert.match(plan.lines[0], /«Фільтр»: 2 → 3 шт\./);
  assert.match(plan.lines[1], /додано «Монтаж» × 1/);
});

test("an order cannot lose its last item or touch items of another order", () => {
  const current = [{ id: "a", title: "Вихлоп", quantity: 1, price: 1000, total: 1000 }];
  assert.throws(
    () => planOrderItemsEdit(current, { update: [], remove: ["a"], add: [] }, "UAH"),
    (error: OrderEditError) => error.code === "NO_ITEMS_LEFT"
  );
  assert.throws(
    () => planOrderItemsEdit(current, { update: [], remove: ["foreign"], add: [] }, "UAH"),
    (error: OrderEditError) => error.code === "ITEM_NOT_FOUND"
  );
});

test("address edits replace known fields and keep carrier data from checkout", () => {
  const { address, changed } = mergeOrderAddress(
    { country: "Ukraine", city: "Київ", line1: "НП 1", region: "Київська", novaPoshta: { ref: "x" } },
    { country: "Ukraine", city: "Львів", line1: "НП 5", region: "", line2: "", postcode: "" }
  );
  assert.equal(changed, true);
  assert.deepEqual(address, {
    country: "Ukraine",
    city: "Львів",
    line1: "НП 5",
    novaPoshta: { ref: "x" },
  });
  assert.equal(
    mergeOrderAddress({ country: "Ukraine" }, { country: "Ukraine", city: "", line1: "" }).changed,
    false
  );
});
