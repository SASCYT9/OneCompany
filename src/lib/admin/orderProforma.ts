import { proformaRecipients, localizeProformaCountry } from "./proformaRecipients";
import { orderItemSnapshotDetails, orderProductLinks } from "@/lib/shopOrderPresentation";

export type ProformaOrder = {
  orderNumber: string;
  conversionNote?: string;
  createdAt: Date | string;
  currency: string;
  customerName: string;
  email: string;
  phone?: string | null;
  shippingAddress: unknown;
  pricingSnapshot?: unknown;
  paymentMethod: string;
  deliveryMethod?: string | null;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  customer?: { companyName?: string | null; vatNumber?: string | null } | null;
  items: {
    title: string;
    productSlug: string;
    variantId?: string | null;
    image?: string | null;
    quantity: number;
    price: number;
    total: number;
  }[];
};
export type ProformaSeller = {
  fopCompanyName?: string | null;
  fopIban?: string | null;
  fopBankName?: string | null;
  fopEdrpou?: string | null;
  fopDetails?: string | null;
  paymentPurpose?: string | null;
  appCompanyName?: string | null;
  appAddress?: string | null;
  appContactEmail?: string | null;
  appContactPhone?: string | null;
};
export const proformaLabels = {
  en: {
    title: "PROFORMA INVOICE",
    order: "ORDER NUMBER",
    date: "ORDER DATE",
    payment: "PAYMENT",
    bill: "BILL TO",
    ship: "SHIP TO",
    item: "ITEM DESCRIPTION",
    qty: "QTY",
    price: "PRICE",
    total: "TOTAL",
    notes: "NOTES",
    subtotal: "Subtotal",
    shipping: "Shipping",
    tax: "Tax",
    noTax: "Not charged",
    noShipping: "No additional charge",
    net: "Total excl. tax",
    adjustment: "Order adjustment",
    paid: "Paid",
    due: "Amount due",
    thanks: "THANKS FOR<br>YOUR BUSINESS!",
    contact: "If you have any questions, please get in touch.",
    transfer: "Please quote your order number as the payment reference.",
    bank: "Bank",
    code: "Registration no.",
    print: "Print / Save as PDF",
    hint: "A4 · Disable browser headers and footers in print settings",
    missing: "Not provided",
    note: "Proforma invoice · Not a confirmation of payment",
    details: "Payment details",
    absent: "Payment details have not been configured.",
    settings: "Configure seller details",
    delivery: "Delivery",
    taxes: "Tax is shown in the order totals.",
    unknown: "To be confirmed",
  },
  ua: {
    title: "РАХУНОК-ПРОФОРМА",
    order: "НОМЕР ЗАМОВЛЕННЯ",
    date: "ДАТА ЗАМОВЛЕННЯ",
    payment: "ОПЛАТА",
    bill: "ПЛАТНИК",
    ship: "ДОСТАВКА",
    item: "НАЙМЕНУВАННЯ ТОВАРУ",
    qty: "К-СТЬ",
    price: "ЦІНА",
    total: "РАЗОМ",
    notes: "ПРИМІТКИ",
    subtotal: "Вартість товарів",
    shipping: "Доставка",
    tax: "Податки",
    noTax: "Не нараховано",
    noShipping: "Без доплати",
    net: "Разом без податків",
    adjustment: "Коригування замовлення",
    paid: "Сплачено",
    due: "До сплати",
    thanks: "ДЯКУЄМО ЗА<br>ВАШЕ ЗАМОВЛЕННЯ!",
    contact: "Якщо у вас виникли запитання, зв’яжіться з нами.",
    transfer: "У призначенні платежу вкажіть номер замовлення.",
    bank: "Банк",
    code: "ЄДРПОУ / РНОКПП",
    print: "Друк / Зберегти PDF",
    hint: "A4 · Вимкніть колонтитули браузера в налаштуваннях друку",
    missing: "Не вказано",
    note: "Рахунок-проформа · Не є підтвердженням оплати",
    details: "Реквізити для оплати",
    absent: "Платіжні реквізити ще не налаштовані.",
    settings: "Налаштувати реквізити продавця",
    delivery: "Доставка",
    taxes: "Податки наведені в підсумку замовлення.",
    unknown: "Потребує уточнення",
  },
};
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c]!
  );
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
function imageUrl(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
export function renderOrderProforma(
  order: ProformaOrder,
  seller: ProformaSeller | null,
  locale: "ua" | "en" = "ua",
  recipientSelection?: string | null
) {
  const t = proformaLabels[locale];
  const money = (v: number) =>
    esc(
      new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "de-DE", {
        style: "currency",
        currency: order.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v)
    );
  const address =
    order.shippingAddress && typeof order.shippingAddress === "object"
      ? (order.shippingAddress as Record<string, unknown>)
      : {};
  const addressLines = [
    text(address.line1),
    text(address.line2),
    [text(address.city), text(address.postcode)].filter(Boolean).join(", "),
    text(address.region),
    localizeProformaCountry(text(address.country), locale),
  ].filter(Boolean);
  const methods: Record<string, string> =
    locale === "ua"
      ? {
          FOP: "Банківський переказ",
          WHITEBIT: "Криптовалюта · Whitepay",
          WHITEPAY_FIAT: "Картка · Whitepay",
        }
      : { FOP: "Bank transfer", WHITEBIT: "Crypto · Whitepay", WHITEPAY_FIAT: "Card · Whitepay" };
  const delivery: Record<string, string> =
    locale === "ua"
      ? { NOVA_POSHTA: "Нова Пошта", SPECIAL: "Спецдоставка", PICKUP: "Самовивіз" }
      : { NOVA_POSHTA: "Nova Poshta", SPECIAL: "Special delivery", PICKUP: "Collection" };
  const adjustment =
    Math.round((order.total - order.subtotal - order.shippingCost - order.taxAmount) * 100) / 100;
  const row = (label: string, amount: number, cls = "") =>
    `<div class="total-row ${cls}"><span>${label}</span><strong>${money(amount)}</strong></div>`;
  const company = seller?.fopCompanyName || seller?.appCompanyName || "OneCompany";
  const recipientQuery = recipientSelection
    ? `&recipient=${encodeURIComponent(recipientSelection)}`
    : "";
  const currencyQuery = `&currency=${encodeURIComponent(order.currency)}`;
  const recipientRequired = recipientSelection !== undefined && !recipientSelection;
  const recipientPicker =
    recipientSelection !== undefined
      ? `<form method="get" class="recipient-picker"><input type="hidden" name="locale" value="${locale}"><label for="recipient">${locale === "ua" ? "Отримувач платежу" : "Payment recipient"}</label><select id="recipient" name="recipient" required onchange="document.getElementById('print-proforma').disabled=true"><option value="">${locale === "ua" ? "Оберіть отримувача" : "Choose a recipient"}</option>${proformaRecipients.map((r) => `<option value="${r.id}" ${!r.available ? "disabled" : ""} ${r.id === recipientSelection ? "selected" : ""}>${esc(locale === "en" ? r.nameEn : r.name)}</option>`).join("")}</select><label for="currency">${locale === "ua" ? "Валюта" : "Currency"}</label><select id="currency" name="currency" onchange="document.getElementById('print-proforma').disabled=true">${["EUR", "USD", "UAH"].map((c) => `<option ${c === order.currency ? "selected" : ""}>${c}</option>`).join("")}</select><button type="submit">${locale === "ua" ? "Застосувати" : "Apply"}</button></form>`
      : "";
  const bankReady = Boolean(seller?.fopCompanyName && seller?.fopIban);
  return `<!doctype html><html lang="${locale === "ua" ? "uk" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title} ${esc(order.orderNumber)}</title><style>
.recipient-picker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%}.recipient-picker label{font-weight:600}.recipient-picker select{max-width:100%;padding:10px;border:1px solid #d3d8de;border-radius:6px;background:white;font:12px Arial}.toolbar button:disabled{opacity:.4;cursor:not-allowed}*{box-sizing:border-box}body{margin:0;background:#edf0f3;color:#303235;font:13px/1.45 Arial,sans-serif}.toolbar{max-width:794px;margin:20px auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:0 16px}.toolbar button,.toolbar a{font:600 12px Arial;padding:10px 14px;border-radius:6px;border:1px solid #d3d8de;background:white;color:#222;text-decoration:none;cursor:pointer}.toolbar button{background:#202327;color:white}.toolbar small{width:100%;color:#626b76}.paper{width:210mm;min-height:297mm;margin:0 auto 28px;padding:15mm 14mm;background:white;box-shadow:0 3px 24px #18233412}.heading{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}.logo{width:230px;max-width:95%;height:auto;margin-top:9px}.heading h1{font-size:19px;margin:0 0 7px;letter-spacing:-.3px}.meta{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;font-size:11px}.meta b{color:#111}.parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:38px 0 32px}.label{font-size:12px;font-weight:700;color:#111;margin:0 0 12px}.party p{margin:0 0 3px;overflow-wrap:anywhere}.contact{font-size:11px;color:#555}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{border-top:2px solid #45484b;border-bottom:1px solid #e4e5e7;padding:8px 4px;text-align:left;font-size:10px;color:#111}th:first-child{width:60%}th:nth-child(2){width:8%}th:nth-child(3),th:nth-child(4){width:16%}td{border-bottom:1px solid #eceef0;padding:20px 4px;vertical-align:middle;font-size:12px}tr{break-inside:avoid}.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.product{display:flex;gap:14px;align-items:center}.product img{width:90px;height:80px;object-fit:contain;flex:none}.product div{min-width:0}.product a{color:inherit;text-decoration:none;font-weight:700;overflow-wrap:anywhere}.sku{margin-top:4px;font-size:11px;color:#64676b;overflow-wrap:anywhere}.summary{display:grid;grid-template-columns:1fr 1fr;gap:28px;border-bottom:2px solid #45484b;padding:0 0 8px;break-inside:avoid}.notes{padding-top:12px;font-size:11px;white-space:pre-line}.total-row{display:flex;justify-content:space-between;gap:12px;padding:9px 3px;border-bottom:1px solid #eceef0;font-size:12px}.total-row strong{font-weight:400;white-space:nowrap}.grand{font-weight:700;color:#111}.grand strong,.due strong{font-weight:700}.due{background:#f4f5f6;padding:10px 8px}.footer{break-inside:avoid}.question{text-align:center;margin:20px 0 27px;font-size:10px}.closing{display:grid;grid-template-columns:1fr 1fr;gap:28px}.seller{text-align:right;font-size:11px;overflow-wrap:anywhere}.seller p{margin:0 0 10px;white-space:pre-line}.thanks{font-size:26px;font-weight:700;line-height:1.35;letter-spacing:-.5px;margin:0}.bank{margin-top:20px;line-height:1.6}.web{text-align:center;margin-top:28px;font-size:12px;font-weight:700}.legal{text-align:center;font-size:9px;color:#74777b;margin-top:8px}.warning{color:#976312;background:#fff6df;padding:8px}.currency{font-size:9px;color:#777}.print-only{display:none}@page{size:A4;margin:12mm 0}@media print{body{background:white}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;padding:0 14mm;box-shadow:none}a{color:inherit}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media screen and (max-width:810px){.paper{width:100%;min-height:0;padding:24px 18px}.heading,.parties,.summary,.closing{gap:16px}.logo{width:190px}.heading h1{font-size:16px}.meta{display:block}.meta b{display:block;margin-top:5px}.product{display:block}.product img{width:68px;height:60px;margin-bottom:8px}.thanks{font-size:20px}td{font-size:10px}.num{white-space:normal}.total-row{font-size:11px}.caption{font-size:10px}}
</style></head><body><nav class="toolbar">${recipientPicker}<button id="print-proforma" type="button" ${recipientRequired ? "disabled" : ""} onclick="printDocument(this)">${t.print}</button>${!recipientRequired ? `<a id="download-proforma" href="?locale=${locale}${recipientQuery}${currencyQuery}&format=pdf">${locale === "ua" ? "Завантажити PDF" : "Download PDF"}</a>` : ""}<span id="print-help" hidden>${locale === "ua" ? "Якщо діалог не відкрився, скористайтеся «Завантажити PDF»." : "If no print dialog opens, use Download PDF."}</span><a href="?locale=ua${recipientQuery}${currencyQuery}" lang="uk">Українська</a><a href="?locale=en${recipientQuery}${currencyQuery}" lang="en">English</a><small>${t.hint}</small>${!bankReady && !recipientRequired ? `<small class="warning">${t.absent} <a href="/admin/shop/settings">${t.settings}</a></small>` : ""}</nav><main class="paper">
<header class="heading"><div><img class="logo" src="/branding/logo-dark.svg" alt="OneCompany"></div><div><h1>${t.title}</h1><div class="meta"><b>${t.order}</b><span>${esc(order.orderNumber)}</span><b>${t.date}</b><span>${esc(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(order.createdAt)))}</span><b>${t.payment}</b><span>${esc(methods[order.paymentMethod] || order.paymentMethod)}</span></div></div></header>
<section class="parties"><div class="party"><h2 class="label">${t.bill}</h2>${order.customer?.companyName ? `<p><b>${esc(order.customer.companyName)}</b></p>` : ""}<p><b>${esc(order.customerName)}</b></p>${order.customer?.vatNumber ? `<p>VAT: ${esc(order.customer.vatNumber)}</p>` : ""}<p class="contact">${esc(order.email)}</p>${order.phone ? `<p class="contact">${esc(order.phone)}</p>` : ""}</div><div class="party"><h2 class="label">${t.ship}</h2><p>${esc(text(address.name) || order.customerName)}</p>${addressLines.length ? addressLines.map((line) => `<p>${esc(line)}</p>`).join("") : `<p>${t.missing}</p>`}</div></section>
<table><thead><tr><th>${t.item}</th><th class="num">${t.qty}</th><th class="num">${t.price}</th><th class="num">${t.total}</th></tr></thead><tbody>${order.items
    .map((item) => {
      const details = orderItemSnapshotDetails(order.pricingSnapshot, item);
      const img = imageUrl(item.image);
      const link = orderProductLinks(item, locale).storefront;
      return `<tr><td><div class="product">${img ? `<img src="${esc(img)}" alt="" loading="eager" referrerpolicy="no-referrer">` : ""}<div>${link ? `<a href="${esc(link)}">${esc(item.title)}</a>` : `<b>${esc(item.title)}</b>`}${details.sku ? `<div class="sku">${esc(details.sku)}</div>` : ""}${details.variantTitle ? `<div class="sku">${esc(details.variantTitle)}</div>` : ""}</div></div></td><td class="num">× ${item.quantity}</td><td class="num">${money(item.price)}</td><td class="num">${money(item.total)}</td></tr>`;
    })
    .join("")}</tbody></table>
<section class="summary"><div class="notes"><h2 class="label">${t.notes}</h2>${order.deliveryMethod ? `${t.delivery}: ${esc(delivery[order.deliveryMethod] || order.deliveryMethod)}<br>` : ""}${t.taxes}<br>${order.conversionNote ? `${esc(order.conversionNote)}<br>` : ""}<span class="currency">${esc(order.currency)} · ${esc(order.orderNumber)}</span></div><div>${row(t.subtotal, order.subtotal)}${order.shippingCost === 0 ? `<div class="total-row"><span>${t.shipping}</span><strong>${t.noShipping}</strong></div>` : row(t.shipping, order.shippingCost)}${adjustment ? row(t.adjustment, adjustment) : ""}${row(t.net, order.total - order.taxAmount)}${order.taxAmount === 0 ? `<div class="total-row"><span>${t.tax}</span><strong>${t.noTax}</strong></div>` : row(t.tax, order.taxAmount)}${row(t.total, order.total, "grand")}${order.amountPaid > 0 ? row(t.paid, order.amountPaid) + row(t.due, Math.max(0, order.total - order.amountPaid), "due") : ""}</div></section>
<footer class="footer"><p class="question">${t.contact}</p><div class="closing"><div class="seller"><p>${esc(company)}${seller?.appAddress ? `<br>${esc(seller.appAddress)}` : ""}${seller?.fopEdrpou ? `<br>${t.code}: ${esc(seller.fopEdrpou)}` : ""}</p><p>${esc(seller?.appContactEmail || "info@onecompany.global")}${seller?.appContactPhone ? `<br>${esc(seller.appContactPhone)}` : ""}</p><div class="bank"><p>${seller?.paymentPurpose ? `${locale === "ua" ? "Призначення платежу:" : "Payment reference (use exactly as written):"}<br><b>${esc(seller.paymentPurpose)}</b>` : `${t.transfer}<br><b>${esc(order.orderNumber)}</b>`}</p>${bankReady ? `<p>IBAN: ${esc(seller?.fopIban)}${seller?.fopBankName ? `<br>${t.bank}: ${esc(seller.fopBankName)}` : ""}</p>${seller?.fopDetails ? `<p>${esc(seller.fopDetails)}</p>` : ""}` : `<p>${t.absent}</p>`}</div></div><p class="thanks">${t.thanks}</p></div><p class="web">onecompany.global</p><p class="legal">${t.note}</p></footer></main>
<script>function printDocument(button){window.print();document.getElementById('print-help').hidden=false}document.querySelector('.recipient-picker')?.addEventListener('change',()=>{const link=document.getElementById('download-proforma');if(link){link.removeAttribute('href');link.setAttribute('aria-disabled','true')}});Promise.all([document.fonts.ready,...Array.from(document.images,image=>image.decode().catch(()=>{}))]).catch(()=>{});</script></body></html>`;
}
