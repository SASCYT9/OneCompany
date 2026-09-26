import assert from "node:assert/strict";
import test from "node:test";
import { isWheelForceWheel, isWheelForceWheelSet, wheelForceSetMoney } from "../../../src/lib/wheelforceFamily";

test("single WheelForce wheels display four units, while complete sets keep their own price", () => {
  const money = { eur: 820, usd: 945, uah: 43460 };
  const single = { brand: "WheelForce", sku: "CF3-5112-1052015DB", tags: ["wheels"] };
  const set = { ...single, sku: "CF3-5112-1052015DB+CF3-5112-1152117DB" };
  assert.equal(isWheelForceWheel(single), true);
  assert.equal(isWheelForceWheelSet(single), false);
  assert.equal(isWheelForceWheelSet(set), true);
  assert.equal(isWheelForceWheel(set), false);
  assert.deepEqual(isWheelForceWheel(single) ? wheelForceSetMoney(money) : money,
    { eur: 3280, usd: 3780, uah: 173840 });
  assert.deepEqual(isWheelForceWheel(set) ? wheelForceSetMoney(money) : money, money);
});

test("normalized catalog set SKUs and explicit set metadata prevent multiplying prices again", () => {
  for (const product of [
    { brand: "WheelForce", partNumber: "CF351121052015DBCF351121152117DB" },
    { brand: "WheelForce", sku: "WFSET-CF3", tags: ["wheels"] },
    { brand: "WheelForce", tags: ["wheels", "wheelforce-wheelset"] },
    { brand: "WheelForce", category: { ua: "Комплекти дисків", en: "Wheel sets" } },
  ]) {
    assert.equal(isWheelForceWheelSet(product), true);
    assert.equal(isWheelForceWheel(product), false);
  }
});

test("accessories and other brands retain their quantities and prices", () => {
  for (const product of [
    { brand: "WheelForce", sku: "WF14042", tags: ["accessories"] },
    { brand: "Burger", sku: "JB4-SUPRA", tags: ["wheels"] },
    { brand: "Urban", sku: "WFSET-CF3", tags: ["wheelforce-wheelset"] },
  ]) {
    assert.equal(isWheelForceWheel(product), false);
    assert.equal(isWheelForceWheelSet(product), false);
  }
});
