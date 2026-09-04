import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderPaymentUpdate } from "../../../src/lib/admin/orderPaymentDraft";
const order = {
  paymentStatus: "UNPAID",
  amountPaid: 0,
  deliveryMethod: null,
  ttnNumber: null,
  shippingCalculatedCost: null,
};
const draft = {
  paymentStatus: "UNPAID",
  amountPaid: "0",
  deliveryMethod: "",
  ttnNumber: "",
  shippingCalculatedCost: "",
};
test("unchanged payment form produces no update", () =>
  assert.deepEqual(buildOrderPaymentUpdate(order, draft), {}));
test("payment update does not reset the existing shipping charge", () =>
  assert.deepEqual(
    buildOrderPaymentUpdate(order, { ...draft, paymentStatus: "PAID", amountPaid: "125.50" }),
    { paymentStatus: "PAID", amountPaid: 125.5 }
  ));
test("explicit shipping override and removal are preserved", () => {
  assert.deepEqual(buildOrderPaymentUpdate(order, { ...draft, shippingCalculatedCost: "12.50" }), {
    shippingCalculatedCost: 12.5,
  });
  assert.deepEqual(buildOrderPaymentUpdate({ ...order, shippingCalculatedCost: 12.5 }, draft), {
    shippingCalculatedCost: null,
  });
});
test("invalid money cannot be submitted", () => {
  for (const amountPaid of ["", "-1", "abc", "Infinity"])
    assert.throws(() => buildOrderPaymentUpdate(order, { ...draft, amountPaid }));
  for (const shippingCalculatedCost of ["-1", "abc", "Infinity"])
    assert.throws(() => buildOrderPaymentUpdate(order, { ...draft, shippingCalculatedCost }));
});
