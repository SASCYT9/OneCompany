import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isPlaceholderShopCustomerEmail,
  isUsableShopCustomerEmail,
  normalizeShopCustomerEmail,
} from "../../../src/lib/shopCustomerEmail";

test("CRM placeholder addresses are recognised and never accepted as real", () => {
  assert.equal(isPlaceholderShopCustomerEmail("crazy.d@crm.onecompany.local"), true);
  assert.equal(isPlaceholderShopCustomerEmail(" Crazy.D@CRM.onecompany.local "), true);
  assert.equal(isPlaceholderShopCustomerEmail("partner@gmail.com"), false);
  assert.equal(isUsableShopCustomerEmail("crazy.d@crm.onecompany.local"), false);
  assert.equal(isUsableShopCustomerEmail("partner@gmail.com"), true);
  assert.equal(isUsableShopCustomerEmail("partner@gmail"), false);
  assert.equal(normalizeShopCustomerEmail("  Partner@Gmail.COM "), "partner@gmail.com");
});

test("managers may change the login email only before the customer has a password", () => {
  const route = readFileSync("src/app/api/admin/shop/customers/[id]/route.ts", "utf8");
  assert.match(route, /account: \{ select: \{ id: true \} \}/);
  assert.match(route, /if \(existing\.account\)/);
  assert.match(route, /isUsableShopCustomerEmail\(nextEmail\)/);
  assert.match(route, /previousEmail: existing\.email/);
});

test("customer create validates the email, rejects duplicates and writes an audit record", () => {
  const route = readFileSync("src/app/api/admin/shop/customers/route.ts", "utf8");
  assert.match(route, /isUsableShopCustomerEmail\(email\)/);
  assert.match(route, /existingCustomerId: existing\.id/);
  assert.match(route, /action: "customer\.create"/);
});

test("the customer card no longer reads the old Airtable CRM", () => {
  const card = readFileSync("src/app/admin/shop/customers/[id]/page.tsx", "utf8");
  assert.doesNotMatch(card, /api\/admin\/crm/);
  assert.doesNotMatch(card, /airtableId/);
});
