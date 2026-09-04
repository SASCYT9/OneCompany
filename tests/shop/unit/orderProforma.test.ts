import test from "node:test";
import assert from "node:assert/strict";
import { renderOrderProforma, type ProformaOrder } from "../../../src/lib/admin/orderProforma";
const order: ProformaOrder = {
  orderNumber: "TEST-2419",
  createdAt: "2026-08-31T08:00:00Z",
  currency: "EUR",
  customerName: "Buyer",
  email: "buyer@example.com",
  shippingAddress: { city: "Kyiv" },
  paymentMethod: "FOP",
  subtotal: 100,
  shippingCost: 10,
  taxAmount: 22,
  total: 127,
  amountPaid: 20,
  items: [
    { title: "Part", productSlug: "part", variantId: "v2", quantity: 2, price: 50, total: 100 },
  ],
  pricingSnapshot: { items: [{ slug: "part", variantId: "v2", sku: "SKU-2" }] },
};
test("proforma preserves saved prices, adjustment and partial payment", () => {
  const html = renderOrderProforma(order, null, "en");
  assert.match(html, /SKU-2/);
  assert.match(html, /Order adjustment/);
  assert.match(html, /-5,00/);
  assert.match(html, /107,00/);
  assert.match(html, /127,00/);
});
test("customer fields and image URLs cannot inject markup", () => {
  const html = renderOrderProforma(
    {
      ...order,
      customerName: "<script>alert(1)</script>",
      shippingAddress: { city: "<img src=x onerror=alert(1)>" },
      items: [{ ...order.items[0], title: "<b>bad</b>", image: "javascript:alert(1)" }],
    },
    null
  );
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes('src="javascript:'));
  assert.match(html, /&lt;b&gt;bad&lt;\/b&gt;/);
  assert.match(html, /&lt;img/);
});
test("missing bank data is explicit and internal notes are excluded", () => {
  const html = renderOrderProforma(
    { ...order, internalNote: "SECRET NOTE" } as ProformaOrder,
    null,
    "en"
  );
  assert.match(html, /Payment details have not been configured/);
  assert.ok(!html.includes("SECRET NOTE"));
  assert.ok(!html.includes("NL43RABO"));
});
test("UA and EN documents use the original SVG, print controls and repeated table headings", () => {
  for (const locale of ["ua", "en"] as const) {
    const html = renderOrderProforma(
      order,
      { fopCompanyName: "Seller", fopIban: "DEMO-IBAN" },
      locale
    );
    assert.match(html, /logo-dark.svg/);
    assert.match(html, /size:A4/);
    assert.match(html, /table-header-group/);
    assert.match(html, /document.fonts.ready/);
    assert.match(html, /DEMO-IBAN/);
  }
});
test("large orders retain every item without placing the entire table in an unbreakable block", () => {
  const html = renderOrderProforma(
    {
      ...order,
      items: Array.from({ length: 55 }, (_, i) => ({
        ...order.items[0],
        title: `Unique part ${i}`,
      })),
    },
    null
  );
  assert.equal((html.match(/Unique part /g) || []).length, 55);
  assert.match(html, /tr\{break-inside:avoid\}/);
});

test("recipient selection and exact payment purpose survive locale switching", async () => {
  const { getProformaRecipient, proformaRecipients } =
    await import("../../../src/lib/admin/proformaRecipients");
  assert.equal(proformaRecipients.length, 2);
  for (const recipient of proformaRecipients) {
    const rearranged = recipient.iban.slice(4) + recipient.iban.slice(0, 4);
    const digits = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
    assert.equal(BigInt(digits) % BigInt(97), BigInt(1));
    const html = renderOrderProforma(
      order,
      {
        fopCompanyName: recipient.legalName,
        fopIban: recipient.iban,
        fopEdrpou: recipient.code,
        fopBankName: recipient.bank,
        paymentPurpose: recipient.purpose,
      },
      "en",
      recipient.id
    );
    assert.ok(html.includes(`?locale=ua&recipient=${recipient.id}`));
    assert.ok(html.includes(recipient.iban));
    if (recipient.id === "poberezhets") {
      assert.ok(html.includes("оплата за запчастини"));
      assert.ok(!html.includes("Please quote your order number as the payment reference."));
    }
  }
  assert.equal(getProformaRecipient("invalid"), null);
  const unselected = renderOrderProforma(order, null, "ua", null);
  assert.match(unselected, /id="print-proforma" type="button" disabled/);
});

test("English recipient details and Ukraine are localized without changing payment data", async () => {
  const { getProformaRecipient, localizeProformaRecipient, localizeProformaCountry } =
    await import("../../../src/lib/admin/proformaRecipients");
  const recipient = getProformaRecipient("recipient-1")!;
  assert.equal(
    localizeProformaRecipient(recipient, "en").legalName,
    "Sole Proprietor Ihor Volodymyrovych Semynozhenko"
  );
  assert.equal(
    localizeProformaRecipient(recipient, "en").bank,
    "UNIVERSAL BANK JSC, bank code 322001"
  );
  assert.equal(localizeProformaRecipient(recipient, "ua").legalName, recipient.legalName);
  assert.equal(localizeProformaCountry("Україна", "en"), "Ukraine");
  assert.equal(localizeProformaCountry("Україна", "ua"), "Україна");
  assert.equal(getProformaRecipient("poberezhets")!.purpose, "оплата за запчастини");
  const html = renderOrderProforma(
    { ...order, shippingAddress: { country: "Україна" } },
    null,
    "en",
    recipient.id
  );
  assert.ok(html.includes("Ukraine"));
  assert.ok(!html.includes("ФОП Семиноженко"));
});

test("currency conversion preserves cents and rejects missing rates", async () => {
  const { convertProforma } = await import("../../../src/lib/admin/proformaCalculation");
  const converted = convertProforma(
    { ...order, total: 201.92, subtotal: 201.92, shippingCost: 0, taxAmount: 0, amountPaid: 0 },
    "UAH",
    { EUR: 1, USD: 1.15, UAH: 53 }
  );
  assert.equal(converted.total, 10701.76);
  assert.equal(converted.currency, "UAH");
  assert.equal(order.currency, "EUR");
  assert.throws(() => convertProforma(order, "USD", { EUR: 1 }), /unavailable/);
  assert.throws(() => convertProforma(order, "GBP", {}), /Unsupported/);
  const html = renderOrderProforma(converted, null, "en", "recipient-1");
  assert.match(html, /Not charged/);
  assert.match(html, /No additional charge/);
  assert.ok(html.includes("currency=UAH&format=pdf"));
  assert.ok(html.includes("1 EUR = 53.000000 UAH"));
  assert.ok(html.includes("function printDocument(button){window.print()"));
});
