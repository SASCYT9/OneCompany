import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateShopLandedCost,
  normalizeShopLandedCostRule,
  resolveShopLandedCostRule,
} from "../../../src/lib/shopLandedCost";

const baseRule = normalizeShopLandedCostRule({
  id: "de-route",
  regionCode: "DE",
  regionName: "Germany",
  regionNameUa: "Німеччина",
  taxRate: 19,
  customsDutyPct: 5,
  brokerageFee: 10,
  handlingFee: 5,
  insurancePct: 1,
  riskReservePct: 2,
  importerOfRecord: "OneCompany / 3PL",
  incoterm: "DDP",
  ddpGuarantee: true,
});

test("DDP calculates the full import charge and includes it in the customer total", () => {
  const breakdown = calculateShopLandedCost({
    rule: baseRule,
    country: "DE",
    currency: "EUR",
    subtotal: 1000,
    shippingCost: 100,
    customsValue: 1000,
    freightAmount: 100,
  });

  assert.ok(breakdown);
  assert.equal(breakdown.dutyAmount, 50);
  assert.equal(breakdown.insuranceAmount, 11);
  assert.equal(breakdown.importVatBase, 1161);
  assert.equal(breakdown.importVatAmount, 220.59);
  assert.equal(breakdown.includedAmount, 300.11);
  assert.equal(breakdown.dueAtDeliveryAmount, 0);
  assert.equal(breakdown.guaranteed, true);
});

test("DAP keeps import charges outside checkout total and marks them due at delivery", () => {
  const breakdown = calculateShopLandedCost({
    rule: { ...baseRule, incoterm: "DAP", ddpGuarantee: false },
    country: "Germany",
    currency: "EUR",
    subtotal: 1000,
    shippingCost: 100,
  });

  assert.ok(breakdown);
  assert.equal(breakdown.includedAmount, 0);
  assert.equal(breakdown.dueAtDeliveryAmount, 300.11);
  assert.equal(breakdown.guaranteed, false);
  assert.equal(breakdown.requiresQuote, false);
});

test("country route matching accepts ISO code and country name", () => {
  assert.equal(resolveShopLandedCostRule([baseRule], "de"), baseRule);
  assert.equal(resolveShopLandedCostRule([baseRule], "Germany"), baseRule);
  assert.equal(resolveShopLandedCostRule([baseRule], "FR"), null);
});
