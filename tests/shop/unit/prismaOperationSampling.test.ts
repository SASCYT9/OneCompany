import assert from "node:assert/strict";
import test from "node:test";
import { describeDbOperationArgs } from "../../../src/lib/prisma";

test("sampled DB operations are described by shape without logging values", () => {
  assert.equal(
    describeDbOperationArgs({
      where: { token: "secret-cart-token", isPublished: true },
      include: { items: true },
      take: 250,
    }),
    "where:isPublished,token include:items take:250"
  );
  assert.equal(describeDbOperationArgs({ data: { email: "buyer@example.invalid" } }), "");
  assert.equal(describeDbOperationArgs(undefined), "");
});
