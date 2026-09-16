import test from "node:test";
import assert from "node:assert/strict";
import {
  draftCatalogPrice,
  draftTotals,
  validateDraftBody,
} from "../../../src/lib/admin/proformaDraft";
import { stockTelegramText, splitTelegramText } from "../../../src/lib/admin/stockTelegram";
import { labelsForProforma } from "../../../src/lib/admin/orderProforma";
import { catalogImageSources } from "../../../src/lib/admin/catalogImageSources";

test("catalog images preserve local paths, deduplicate fallbacks and reject unsafe schemes", () => {
  assert.deepEqual(
    catalogImageSources([
      "/images/a.webp",
      "https://cdn.example.com/a.jpg",
      "/images/a.webp",
      "javascript:alert(1)",
      "//evil.example/x",
      "https://user:pass@example.com/a",
      null,
      "",
    ]),
    ["/images/a.webp", "https://cdn.example.com/a.jpg"]
  );
});

const body = {
  customerName: "Test Client",
  email: "client@example.com",
  currency: "EUR",
  items: [{ productId: "p1", productSlug: "test", title: "Test part", quantity: 3, price: 0.1 }],
  shippingCost: 0.2,
};
test("draft totals use integer cents and match line totals", () => {
  assert.deepEqual(draftTotals(body.items, 0.2), { subtotal: 0.3, total: 0.5 });
  assert.equal(validateDraftBody(body), null);
  assert.deepEqual(draftTotals([{ price: 12.35, quantity: 3 }], 5.67, 1.22), {
    subtotal: 37.05,
    total: 43.94,
  });
});
test("reject invalid money, currency, items and customer before writes", () => {
  for (const input of [
    null,
    [],
    {},
    { ...body, currency: "GBP" },
    { ...body, email: "x" },
    { ...body, customerName: " " },
    { ...body, shippingCost: -1 },
    { ...body, taxAmount: Infinity },
    { ...body, validUntil: "nonsense" },
    { ...body, shippingAddress: [] },
    { ...body, items: [] },
    { ...body, items: Array(201).fill(body.items[0]) },
  ])
    assert.ok(validateDraftBody(input));
  for (const price of [NaN, Infinity, -1, 0.001, "4", null])
    assert.ok(validateDraftBody({ ...body, items: [{ ...body.items[0], price }] }));
  for (const quantity of [0, -1, 0.5, 10001, "2", null])
    assert.ok(validateDraftBody({ ...body, items: [{ ...body.items[0], quantity }] }));
  assert.ok(
    validateDraftBody({ ...body, items: [{ ...body.items[0], price: 9999999999.99, quantity: 2 }] })
  );
  assert.equal(validateDraftBody({ ...body, items: [{ ...body.items[0], price: 0 }] }), null);
});
test("variant null inherits while zero is preserved and currencies never get relabelled", () => {
  const product = { priceEur: 100, priceEurB2b: 85 };
  assert.equal(draftCatalogPrice(product, { priceEur: null }, "EUR", false), 100);
  assert.equal(draftCatalogPrice(product, { priceEur: 110, priceEurB2b: 75 }, "EUR", true), 75);
  assert.equal(draftCatalogPrice(product, { priceEur: 0 }, "EUR", false), 0);
  assert.equal(draftCatalogPrice(product, null, "USD", true), null);
  assert.equal(draftCatalogPrice(product, null, "EUR", false), 100);
});
const product = {
  id: "1",
  titleEn: "Eventuri EVE-G9X-CF-INT BMW G9X M5 Black Carbon Intake System (Gloss Finish)",
  titleUa: "Впуск BMW G9X M5",
  brand: "Eventuri",
  sku: "EVE-G9X-CF-INT",
  stock: "inStock",
};
test("Telegram export uses only unique in-stock selections, grouped without duplicate SKU prefixes", () => {
  const result = stockTelegramText([product, product, { ...product, id: "2", stock: "preOrder" }]);
  assert.equal(
    result,
    "В НАЯВНОСТІ\n\nEVENTURI\n\n• BMW G9X M5 Black Carbon Intake System (Gloss Finish)\n  Артикул: EVE-G9X-CF-INT"
  );
  assert.equal(stockTelegramText([]), "");
  assert.match(stockTelegramText([product], "ua"), /Впуск BMW/);
});
test("Telegram export strips newlines in metadata and excludes unselected/private fields", () => {
  const result = stockTelegramText([
    { ...product, sku: "ABC\n  DEF", price: 999, internalNote: "secret" } as typeof product,
  ]);
  assert.match(result, /Артикул: ABC DEF/);
  assert.doesNotMatch(result, /secret|999/);
});
test("large Telegram lists split into bounded messages without dropping contents", () => {
  const text = stockTelegramText(
    Array.from({ length: 200 }, (_, i) => ({
      ...product,
      id: String(i),
      titleEn: `BMW product ${i}`,
      sku: `SKU-${i}`,
    }))
  );
  const parts = splitTelegramText(text);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= 3800));
  assert.equal(parts.join("\n\n"), text);
  assert.deepEqual(splitTelegramText(""), []);
});
test("advance proforma labels distinguish draft from actual order in both renderers", () => {
  assert.equal(labelsForProforma("ua", true).order, "НОМЕР ПРОФОРМИ");
  assert.equal(labelsForProforma("en", true).order, "PROFORMA NUMBER");
  assert.equal(labelsForProforma("ua").order, "НОМЕР ЗАМОВЛЕННЯ");
});
