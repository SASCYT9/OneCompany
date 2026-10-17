import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  "src/app/[locale]/shop/checkout/success/ShopOrderSuccessClient.tsx",
  "utf8"
);

test("thank-you page reads the shipping agreement status, not the shipping amount", () => {
  // A provisional non-zero quote is still pending; an agreed free delivery is final.
  assert.match(page, /internationalDelivery\?\.status === "awaiting_agreement"/);
  assert.doesNotMatch(page, /shippingAwaitsAgreement = Boolean\([^)]*shippingCost/);
  assert.match(page, /буде узгоджена з менеджером/);
  assert.match(page, /to be agreed with a manager/);
});
