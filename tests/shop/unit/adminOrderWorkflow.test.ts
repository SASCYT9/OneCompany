import test from "node:test";
import assert from "node:assert/strict";

import {
  canAdvanceOrderStatus,
  composeOrderStatusNote,
  isOrderTransitionAllowed,
  isStaleOrder,
  orderNextStep,
  orderStatusChangeProblem,
  orderStatusMove,
  orderStatusReasonMissing,
} from "../../../src/lib/admin/orderWorkflow";

const unpaid = { amountPaid: 0, paymentStatus: "UNPAID", isDraft: false };
const paid = { amountPaid: 1000, paymentStatus: "PAID", isDraft: false };

test("every mistaken status can be undone, and a cancelled order can be restored", () => {
  assert.ok(isOrderTransitionAllowed("CONFIRMED", "PENDING_PAYMENT"));
  assert.ok(isOrderTransitionAllowed("SHIPPED", "PROCESSING"));
  assert.ok(isOrderTransitionAllowed("DELIVERED", "SHIPPED"));
  assert.ok(isOrderTransitionAllowed("CANCELLED", "PENDING_REVIEW"));
  assert.ok(isOrderTransitionAllowed("REFUNDED", "DELIVERED"));
  // Old orders handed over long ago can be closed in one step.
  assert.ok(isOrderTransitionAllowed("PENDING_REVIEW", "DELIVERED"));
  assert.equal(isOrderTransitionAllowed("DELIVERED", "PENDING_REVIEW"), false);
  assert.equal(isOrderTransitionAllowed("CANCELLED", "SHIPPED"), false);
});

test("moves are classified so corrections are recognisable", () => {
  assert.equal(orderStatusMove("PENDING_REVIEW", "CONFIRMED"), "forward");
  assert.equal(orderStatusMove("PENDING_PAYMENT", "PENDING_REVIEW"), "back");
  assert.equal(orderStatusMove("SHIPPED", "CANCELLED"), "cancel");
  assert.equal(orderStatusMove("CANCELLED", "PENDING_REVIEW"), "restore");
  assert.equal(orderStatusMove("DELIVERED", "REFUNDED"), "refund");
  assert.equal(orderStatusMove("CONFIRMED", "CONFIRMED"), "same");
});

test("automatic tracking updates only ever move an order forward", () => {
  assert.ok(canAdvanceOrderStatus("PROCESSING", "SHIPPED"));
  assert.ok(canAdvanceOrderStatus("SHIPPED", "DELIVERED"));
  assert.equal(canAdvanceOrderStatus("DELIVERED", "SHIPPED"), false);
  assert.equal(canAdvanceOrderStatus("CANCELLED", "SHIPPED"), false);
});

test("a paid order never goes back to a state that offers a second payment", () => {
  assert.equal(
    orderStatusChangeProblem({ status: "CONFIRMED", ...paid }, "PENDING_PAYMENT"),
    "ORDER_ALREADY_PAID"
  );
  assert.equal(
    orderStatusChangeProblem({ status: "CANCELLED", ...paid }, "PENDING_REVIEW"),
    "ORDER_ALREADY_PAID"
  );
  assert.equal(orderStatusChangeProblem({ status: "CANCELLED", ...paid }, "CONFIRMED"), null);
  assert.equal(orderStatusChangeProblem({ status: "CONFIRMED", ...unpaid }, "PENDING_PAYMENT"), null);
  assert.equal(
    orderStatusChangeProblem({ status: "PENDING_REVIEW", ...unpaid, isDraft: true }, "CONFIRMED"),
    "DRAFT"
  );
  assert.equal(
    orderStatusChangeProblem({ status: "DELIVERED", ...unpaid }, "PENDING_REVIEW"),
    "TRANSITION_NOT_ALLOWED"
  );
});

test("cancellations need a reason, corrections need a note, normal progress needs nothing", () => {
  const cancel = { from: "PENDING_REVIEW", to: "CANCELLED" };
  assert.equal(orderStatusReasonMissing({ ...cancel }), true);
  assert.equal(orderStatusReasonMissing({ ...cancel, reason: "fake" }), false);
  assert.equal(orderStatusReasonMissing({ ...cancel, reason: "other" }), true);
  assert.equal(orderStatusReasonMissing({ ...cancel, reason: "other", note: "клієнт пропав" }), false);
  assert.equal(orderStatusReasonMissing({ ...cancel, reason: "invented" }), true);
  assert.equal(orderStatusReasonMissing({ from: "SHIPPED", to: "PROCESSING" }), true);
  assert.equal(orderStatusReasonMissing({ from: "SHIPPED", to: "PROCESSING", note: "помилка" }), false);
  assert.equal(orderStatusReasonMissing({ from: "CONFIRMED", to: "PROCESSING" }), false);
});

test("the history line names the cancellation reason", () => {
  assert.equal(
    composeOrderStatusNote({ from: "PENDING_REVIEW", to: "CANCELLED", reason: "fake", note: "бот" }),
    "Фейкове замовлення / спам. бот"
  );
  assert.equal(
    composeOrderStatusNote({ from: "PENDING_REVIEW", to: "CANCELLED", reason: "test" }),
    "Тестове замовлення"
  );
  assert.equal(
    composeOrderStatusNote({ from: "PENDING_REVIEW", to: "CANCELLED", reason: "other", note: "x" }),
    "x"
  );
  assert.equal(composeOrderStatusNote({ from: "CONFIRMED", to: "PROCESSING" }), null);
});

test("the next step offers the obvious move, a way back and cancellation", () => {
  const waiting = orderNextStep({ status: "PENDING_PAYMENT", ...unpaid });
  assert.equal(waiting.primary?.to, "CONFIRMED");
  assert.equal(waiting.back?.to, "PENDING_REVIEW");
  assert.ok(waiting.canCancel);

  const processing = orderNextStep({ status: "PROCESSING", ...paid });
  assert.equal(processing.primary?.to, "SHIPPED");
  assert.equal(processing.back?.to, "CONFIRMED");

  // A paid order skips the «waiting for payment» states on the way back.
  const confirmedPaid = orderNextStep({ status: "CONFIRMED", ...paid });
  assert.equal(confirmedPaid.back, null);

  assert.equal(orderNextStep({ status: "CANCELLED", ...unpaid }).primary?.to, "PENDING_REVIEW");
  assert.equal(orderNextStep({ status: "CANCELLED", ...paid }).primary?.to, "CONFIRMED");
  assert.equal(orderNextStep({ status: "DELIVERED", ...paid }).canCancel, false);
});

test("orders waiting for a month are flagged as stale", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  assert.ok(isStaleOrder({ status: "PENDING_REVIEW", createdAt: "2026-09-01T12:00:00Z" }, now));
  assert.equal(isStaleOrder({ status: "PENDING_REVIEW", createdAt: "2026-10-01T12:00:00Z" }, now), false);
  assert.equal(isStaleOrder({ status: "SHIPPED", createdAt: "2026-01-01T12:00:00Z" }, now), false);
});
