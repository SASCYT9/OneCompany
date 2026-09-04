import assert from "node:assert/strict";
import test from "node:test";
import {
  orderAddressText,
  orderProductLinks,
  orderItemSnapshotDetails,
} from "../../../src/lib/shopOrderPresentation";
import {
  buildShopOrderTelegram,
  type ShopOrderNotification,
} from "../../../src/lib/shopOrderTelegram";

const order: ShopOrderNotification = {
  orderId: "order-123",
  orderNumber: "OC-2026-00022",
  customerName: "Олена <Тест>",
  phone: "+380501234567",
  email: "test@example.com",
  currency: "EUR",
  total: 201.92,
  shippingCost: 10,
  taxAmount: 0,
  paymentMethod: "FOP",
  paymentStatus: "UNPAID",
  itemCount: 2,
  shippingAddress: { country: "UA", city: "Київ", line1: "Відділення 12" },
  items: [
    {
      productSlug: "carbon-spoiler",
      productId: "product-1",
      title: "Спойлер & кріплення",
      quantity: 2,
      unitPrice: 95.96,
      total: 191.92,
    },
  ],
};

test("notification includes buyer, delivery, exact money and authenticated order link", () => {
  const result = buildShopOrderTelegram(order);
  assert.match(result.message, /Олена &lt;Тест&gt;/);
  assert.match(result.message, /\+380501234567/);
  assert.match(result.message, /Київ, Відділення 12/);
  assert.match(result.message, /201\.92 EUR/);
  assert.match(result.message, /2 × 95\.96 EUR/);
  assert.match(result.message, /https:\/\/onecompany.global\/ua\/shop\/carbon-spoiler/);
  assert.equal(
    result.replyMarkup.inline_keyboard[0][0].url,
    "https://onecompany.global/admin/shop/orders/order-123"
  );
  assert.doesNotMatch(result.message, /viewToken|token=/);
});

test("large orders stay bounded without broken HTML entities or silently omitted items", () => {
  const result = buildShopOrderTelegram({
    ...order,
    customerName: "<&".repeat(5000),
    email: "&".repeat(5000),
    shippingAddress: { line1: "&".repeat(10000) },
    items: Array.from({ length: 100 }, () => ({ ...order.items[0], title: "<&".repeat(5000) })),
  });
  assert.ok(result.message.length < 4096);
  assert.match(result.message, /Ще \d+ позицій/);
  assert.equal(
    (result.message.match(/<a /g) || []).length,
    (result.message.match(/<\/a>/g) || []).length
  );
});

test("manual items do not lead to nonexistent storefront pages", () => {
  assert.deepEqual(orderProductLinks({ productSlug: "crm-manual" }), {
    storefront: null,
    admin: null,
  });
  assert.equal(
    orderProductLinks({ productSlug: "turn14-123", productId: "p1" }).admin,
    "/admin/shop/p1"
  );
  assert.equal(orderProductLinks({ productSlug: 'a/"b' }).storefront, "/ua/shop/a%2F%22b");
  assert.equal(orderAddressText(null), "");
  assert.equal(orderAddressText({ city: " Kyiv ", line1: { bad: true } }), "Kyiv");
});

test("SKU and selected option come from the matching historical variant", () => {
  const snapshot = {
    items: [
      { slug: "spoiler", variantId: "black", sku: "BLACK-1", variantTitle: "Black" },
      { slug: "spoiler", variantId: "carbon", sku: "CARBON-1", variantTitle: "Carbon" },
    ],
  };
  assert.deepEqual(
    orderItemSnapshotDetails(snapshot, { productSlug: "spoiler", variantId: "carbon" }),
    { sku: "CARBON-1", variantTitle: "Carbon" }
  );
  assert.deepEqual(orderItemSnapshotDetails(null, { productSlug: "old-order" }), {
    sku: null,
    variantTitle: null,
  });
  assert.match(
    buildShopOrderTelegram({ ...order, requiresQuote: true }).message,
    /Доставка: потребує уточнення/
  );
});
