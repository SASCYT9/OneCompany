import fs from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";

const ROOT = "D:/OneCompany";
const OUT = "D:/OneCompany/artifacts/customer-presentation/output";
const SCRATCH = "D:/OneCompany/artifacts/customer-presentation/scratch";
const W = 1920;
const H = 1080;
const PX = 144;
const C = {
  obsidian: "090909",
  black: "0B0A09",
  graphite: "171513",
  bronze: "B08A57",
  bronze2: "D2B172",
  ivory: "F2E9D8",
  soft: "B9B0A3",
  muted: "746E66",
  red: "A7342D",
  green: "6FA47A",
  blue: "7897B7",
};

function abs(p) {
  return path.join(ROOT, p).replaceAll("\\", "/");
}

function inch(v) {
  return v / PX;
}

function frame(f) {
  return { x: inch(f.x), y: inch(f.y), w: inch(f.w), h: inch(f.h) };
}

function hex(c) {
  return c.startsWith("#") ? c.slice(1) : c;
}

let currentSlide = -1;
const previewItems = [];

function beginSlide(num) {
  currentSlide = num - 1;
  previewItems[currentSlide] = { items: [] };
}

function pushPreview(item) {
  if (currentSlide >= 0) previewItems[currentSlide].items.push(item);
}

function addBg(slide, color = C.obsidian) {
  slide.background = { color };
  pushPreview({ type: "rect", x: 0, y: 0, w: W, h: H, fill: color });
}

function addRect(slide, f, color, line = color, transparency = 0) {
  slide.addShape(pptx.ShapeType.rect, {
    ...frame(f),
    fill: { color, transparency },
    line: { color: line, transparency: line === "transparent" ? 100 : 0, width: 1 },
  });
  pushPreview({ type: "rect", ...f, fill: color, stroke: line, opacity: Math.max(0, Math.min(1, 1 - transparency / 100)) });
}

function addLine(slide, x, y, w, color = C.bronze, weight = 2) {
  slide.addShape(pptx.ShapeType.line, {
    x: inch(x),
    y: inch(y),
    w: inch(w),
    h: 0,
    line: { color, width: weight },
  });
  pushPreview({ type: "line", x, y, w, color, weight });
}

function addText(slide, txt, f, opts = {}) {
  slide.addText(txt, {
    ...frame(f),
    fontFace: opts.fontFace || "Segoe UI",
    fontSize: opts.size || 20,
    bold: opts.bold || false,
    color: opts.color || C.ivory,
    margin: 0,
    fit: "shrink",
    breakLine: false,
    valign: opts.valign || "top",
    align: opts.align || "left",
  });
  pushPreview({
    type: "text",
    text: txt,
    ...f,
    size: (opts.size || 20) * 1.9,
    color: opts.color || C.ivory,
    bold: opts.bold || false,
    align: opts.align || "left",
    maxChars: Math.max(18, Math.floor(f.w / ((opts.size || 20) * 0.72))),
  });
}

async function prepImage(name, src, width, height, fit = "cover", bg = "#090909") {
  const out = path.join(SCRATCH, `${name}.jpg`);
  const resize =
    fit === "contain"
      ? { width, height, fit: "contain", background: bg }
      : { width, height, fit: "cover", position: "center" };
  await sharp(src).resize(resize).jpeg({ quality: 88 }).toFile(out);
  return out.replaceAll("\\", "/");
}

function addImage(slide, p, f) {
  slide.addImage({ path: p, ...frame(f) });
  pushPreview({ type: "image", path: p, ...f });
}

function title(slide, t, sub, n) {
  addText(slide, t, { x: 110, y: 68, w: 1180, h: 96 }, { fontFace: "Bahnschrift", size: 33, bold: true });
  if (sub) addText(slide, sub, { x: 112, y: 172, w: 1160, h: 56 }, { size: 14.5, color: C.soft });
  addLine(slide, 112, sub ? 250 : 172, 180, C.bronze, 2.2);
  addText(slide, String(n).padStart(2, "0"), { x: 1730, y: 78, w: 80, h: 32 }, { fontFace: "Bahnschrift", size: 13, bold: true, color: C.bronze2, align: "right" });
}

function footer(slide, source = "Джерело: локальний репозиторій OneCompany.") {
  addText(slide, source, { x: 112, y: 1010, w: 1390, h: 26 }, { size: 7.5, color: C.muted });
  addText(slide, "OneCompany · customer presentation", { x: 1510, y: 1010, w: 300, h: 26 }, { size: 7.5, color: C.muted, align: "right" });
}

function bullet(slide, txt, x, y, w, accent = C.bronze) {
  slide.addShape(pptx.ShapeType.ellipse, { x: inch(x), y: inch(y + 14), w: inch(12), h: inch(12), fill: { color: accent }, line: { color: accent } });
  addText(slide, txt, { x: x + 28, y, w, h: 52 }, { size: 15, color: C.ivory });
}

function metric(slide, v, label, x, y, w = 280) {
  addText(slide, v, { x, y, w, h: 72 }, { fontFace: "Bahnschrift", size: 39, bold: true, color: C.bronze2 });
  addText(slide, label, { x: x + 4, y: y + 78, w, h: 40 }, { size: 12.5, color: C.soft });
}

function record(num, items) {
  // Kept for older build calls; preview items are now captured by addImage/addText/addRect.
}

function svgText(txt, x, y, size, color, weight = 400, max = 58) {
  const words = String(txt).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => `<text x="${x}" y="${y + i * size * 1.18}" fill="#${color}" font-family="Segoe UI, Arial" font-size="${size}" font-weight="${weight}">${escapeXml(l)}</text>`).join("");
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m]);
}

async function dataUri(p) {
  const b = await fs.readFile(p);
  return `data:image/jpeg;base64,${b.toString("base64")}`;
}

async function renderPreview(num, bgColor, draw) {
  const tags = [];
  for (const it of previewItems[num - 1]?.items || []) {
    if (it.type === "image") {
      const href = await dataUri(it.path);
      tags.push(`<image href="${href}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/>`);
    } else if (it.type === "rect") {
      tags.push(`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="#${hex(it.fill)}" stroke="${it.stroke === "transparent" ? "none" : `#${hex(it.stroke || it.fill)}`}" opacity="${it.opacity ?? 1}"/>`);
    } else if (it.type === "line") {
      tags.push(`<line x1="${it.x}" y1="${it.y}" x2="${it.x + it.w}" y2="${it.y}" stroke="#${hex(it.color)}" stroke-width="${it.weight * 2}"/>`);
    } else if (it.type === "text") {
      tags.push(svgText(it.text, it.x, it.y + it.size, it.size, it.color, it.bold ? 700 : 400, it.maxChars));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#${bgColor}"/>
    ${tags.join("\n")}
    ${draw()}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(SCRATCH, `pptxgen-slide-${String(num).padStart(2, "0")}.png`));
}

let pptx;

async function build() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(SCRATCH, { recursive: true });
  const img = {
    cover: await prepImage("asset-cover-brabus", abs("public/images/shop/brabus/hq/brabus_gclass_stealth.png"), 960, 1080),
    adro: await prepImage("asset-adro-catalog", abs("adro-catalog-en-desktop.png"), 720, 500, "contain"),
    akra: await prepImage("asset-akra-race", abs("public/images/shop/akrapovic/gallery/live/akrapovic-race-car-live.webp"), 820, 330),
    giro: await prepImage("asset-girodisc", abs("girodisc_home.png"), 700, 470),
    brabusEngine: await prepImage("asset-brabus-engine", abs("public/images/shop/brabus/hq/brabus_carbon_engine.png"), 560, 560),
  };

  pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "OneCompany";
  pptx.subject = "Customer presentation";
  pptx.title = "OneCompany Customer Presentation";
  pptx.company = "OneCompany";
  pptx.lang = "uk-UA";
  pptx.theme = {
    headFontFace: "Bahnschrift",
    bodyFontFace: "Segoe UI",
    lang: "uk-UA",
  };

  let s = pptx.addSlide();
  beginSlide(1);
  addBg(s);
  addImage(s, img.cover, { x: 960, y: 0, w: 960, h: 1080 });
  addRect(s, { x: 0, y: 0, w: 1180, h: 1080 }, C.obsidian, C.obsidian, 15);
  addRect(s, { x: 102, y: 178, w: 10, h: 720 }, C.bronze);
  addText(s, "ONECOMPANY", { x: 134, y: 138, w: 540, h: 42 }, { fontFace: "Bahnschrift", size: 16, bold: true, color: C.bronze2 });
  addText(s, "Premium automotive commerce platform", { x: 132, y: 286, w: 830, h: 220 }, { fontFace: "Bahnschrift", size: 43, bold: true });
  addText(s, "Storefront, B2B operations, catalog sync, CRM and payments in one operational system.", { x: 136, y: 536, w: 760, h: 90 }, { size: 17, color: C.soft });
  addText(s, "Презентація проекту для замовника · 2026", { x: 136, y: 890, w: 670, h: 30 }, { size: 12, color: C.muted });
  record(1, { images: [{ path: img.cover, x: 960, y: 0, w: 960, h: 1080 }] });

  s = pptx.addSlide();
  beginSlide(2);
  addBg(s);
  title(s, "Що будує OneCompany", "Преміальна ecommerce та CRM-платформа для авто- і мото performance-напрямку.", 2);
  addImage(s, img.adro, { x: 1010, y: 160, w: 720, h: 500 });
  metric(s, "249", "локальних brand definitions", 120, 360);
  metric(s, "UA/EN", "обов'язкова локалізація", 430, 360);
  metric(s, "12", "активних shop image sets", 720, 360);
  bullet(s, "Клієнт бачить premium storefront з реальними брендовими assets.", 120, 610, 760);
  bullet(s, "Команда керує каталогом, цінами, замовленнями, клієнтами й SEO з admin-зони.", 120, 680, 800);
  bullet(s, "Архітектура враховує B2C, B2B, Turn14, WhitePay, валютні курси та логістику.", 120, 750, 820);
  footer(s, "Джерела: README.md; src/lib/brands.ts; public/images/shop/*; .agents/PROJECT_CONTEXT.md.");
  record(2, { images: [{ path: img.adro, x: 1010, y: 160, w: 720, h: 500 }] });

  s = pptx.addSlide();
  beginSlide(3);
  addBg(s, C.black);
  title(s, "Storefront як вітрина довіри", "Брендова подача, локалізована навігація, товарні сторінки і швидкий запит.", 3);
  addImage(s, img.akra, { x: 110, y: 330, w: 820, h: 330 });
  addImage(s, img.giro, { x: 1010, y: 330, w: 700, h: 470 });
  addText(s, "CUSTOMER JOURNEY", { x: 114, y: 715, w: 360, h: 28 }, { fontFace: "Bahnschrift", size: 9, bold: true, color: C.bronze2 });
  bullet(s, "Localized routes under /[locale]/shop, /brands, /categories, /contact.", 116, 765, 760, C.blue);
  bullet(s, "Product detail layouts include media, pricing bands, B2B visibility and request flows.", 116, 830, 830, C.blue);
  addText(s, "VISUAL STANDARD", { x: 1016, y: 835, w: 360, h: 28 }, { fontFace: "Bahnschrift", size: 9, bold: true, color: C.bronze2 });
  addText(s, "Real official imagery only; no stock filler. Premium automotive luxury: obsidian, bronze, restraint.", { x: 1016, y: 882, w: 710, h: 70 }, { size: 15, color: C.ivory });
  footer(s, "Джерела: src/app/[locale]/shop; src/app/[locale]/brands; public/images/shop/*.");
  record(3, { images: [{ path: img.akra, x: 110, y: 330, w: 820, h: 330 }, { path: img.giro, x: 1010, y: 330, w: 700, h: 470 }] });

  s = pptx.addSlide();
  beginSlide(4);
  addBg(s);
  title(s, "Каталог побудований як операційна база", "Prisma schema фіксує продукт, варіанти, медіа, категорії, колекції, склади, логістику та податки.", 4);
  ["Product", "Variant", "Media", "Inventory", "Order"].forEach((label, i) => {
    const x = [145, 465, 785, 1105, 1425][i];
    const y = 360 + (i % 2) * 85;
    addRect(s, { x, y, w: 230, h: 96 }, i === 0 ? C.bronze : C.graphite, [C.bronze, C.bronze2, C.blue, C.green, C.red][i]);
    addText(s, label, { x: x + 24, y: y + 28, w: 190, h: 40 }, { fontFace: "Bahnschrift", size: 17, bold: true, color: i === 0 ? C.obsidian : C.ivory, align: "center" });
    if (i < 4) addLine(s, x + 235, y + 48, 108, C.muted, 1.5);
  });
  bullet(s, "ShopProduct is the source for localized titles, SEO copy, status, brand and base pricing.", 150, 680, 760);
  bullet(s, "ShopProductVariant carries SKU, Turn14 ID/hash, B2B prices, dimensions and inventory relations.", 150, 750, 820);
  bullet(s, "ShopOrder keeps customer snapshot, pricing snapshot, payment status, shipments and status events.", 150, 820, 850);
  footer(s, "Джерело: prisma/schema.prisma models ShopProduct, ShopProductVariant, ShopOrder, ShopWarehouse.");
  record(4, { images: [] });

  s = pptx.addSlide();
  beginSlide(5);
  addBg(s, "0A0B0A");
  title(s, "B2B і B2C не змішані", "Платформа відділяє публічну покупку від партнерських умов, approval-логіки і персональних знижок.", 5);
  addText(s, "B2C", { x: 150, y: 360, w: 520, h: 80 }, { fontFace: "Bahnschrift", size: 33, bold: true });
  addLine(s, 150, 448, 180, C.blue, 2.2);
  addText(s, "Catalog visibility, cart, localized price display and customer checkout.", { x: 150, y: 500, w: 640, h: 86 }, { size: 18, color: C.soft });
  addText(s, "UAH / EUR / USD display is computed through currency helpers and runtime rates.", { x: 150, y: 615, w: 640, h: 70 }, { size: 14.5 });
  addText(s, "B2B", { x: 1010, y: 360, w: 520, h: 80 }, { fontFace: "Bahnschrift", size: 33, bold: true, color: C.bronze2 });
  addLine(s, 1010, 448, 180, C.bronze, 2.2);
  addText(s, "Approved-only visibility, account group, company data and customer-specific discount percent.", { x: 1010, y: 500, w: 640, h: 86 }, { size: 18, color: C.soft });
  addText(s, "Admin order creation injects B2B discounts and keeps customer group snapshots.", { x: 1010, y: 615, w: 640, h: 70 }, { size: 14.5 });
  footer(s, "Джерела: prisma/schema.prisma ShopSettings/ShopCustomer/ShopOrder; src/lib/shopDisplayPrices.ts.");
  record(5, { images: [] });

  s = pptx.addSlide();
  beginSlide(6);
  addBg(s);
  title(s, "Turn14 інтеграція збережена як supply backbone", "Локальний mirror знімає залежність від зовнішнього пошуку і дає контроль над цінами, брендами та sync-status.", 6);
  [["Brand lookup", "знаходимо бренд у Turn14"], ["Paginated fetch", "витягуємо всі item pages"], ["Normalize", "slug, SKU, dimensions, HTML"], ["Upsert DB", "ShopProduct + Variant + Media"], ["Markup", "brand/customer B2B overrides"]].forEach(([a, b], i) => {
    const x = 130 + i * 340;
    addText(s, `0${i + 1}`, { x, y: 365, w: 96, h: 70 }, { fontFace: "Bahnschrift", size: 31, bold: true, color: C.bronze2 });
    addLine(s, x, 446, 210, i % 2 ? C.blue : C.bronze, 1.7);
    addText(s, a, { x, y: 482, w: 265, h: 42 }, { fontFace: "Bahnschrift", size: 17, bold: true });
    addText(s, b, { x, y: 535, w: 255, h: 66 }, { size: 12.5, color: C.soft });
  });
  addText(s, "Operational point: imported supplier data becomes local commerce data before it reaches customer-facing pages.", { x: 130, y: 760, w: 1240, h: 72 }, { size: 20, bold: true });
  footer(s, "Джерела: src/lib/turn14.ts; src/lib/turn14Sync.ts; src/lib/turn14Pricing.ts; prisma Turn14CatalogItem.");
  record(6, { images: [] });

  s = pptx.addSlide();
  beginSlide(7);
  addBg(s, "100E0C");
  title(s, "Замовлення і платежі вже мають production контур", "Cart → order → payment link → callback/status → admin order management.", 7);
  addImage(s, img.brabusEngine, { x: 1140, y: 210, w: 560, h: 560 });
  [["Cart", "token, locale, currency, cart items"], ["Order", "customer snapshot, totals, status events"], ["WhitePay", "fiat and crypto order creation routes"], ["Admin", "manual order, invoice, payment status"]].forEach(([a, b], i) => {
    const y = 330 + i * 120;
    addText(s, a, { x: 130, y, w: 230, h: 52 }, { fontFace: "Bahnschrift", size: 23, bold: true, color: i === 2 ? C.bronze2 : C.ivory });
    addLine(s, 375, y + 28, 470, i === 2 ? C.bronze : C.muted, 1.5);
    addText(s, b, { x: 880, y: y + 2, w: 250, h: 44 }, { size: 12.5, color: C.soft });
  });
  footer(s, "Джерела: src/lib/shopWhitepay.ts; src/app/api/admin/shop/orders; prisma ShopCart/ShopOrder.");
  record(7, { images: [{ path: img.brabusEngine, x: 1140, y: 210, w: 560, h: 560 }] });

  s = pptx.addSlide();
  beginSlide(8);
  addBg(s);
  title(s, "Admin зона закриває щоденні операції", "Не просто CMS: управління каталогом, цінами, замовленнями, клієнтами, логістикою, SEO і supplier sync.", 8);
  [["Catalog", "products, variants, media, bundles"], ["Orders", "draft/manual orders, status, payments"], ["CRM", "customers, B2B groups, discounts"], ["Inventory", "stock, warehouses, logistics rules"], ["Turn14", "brand markups, sync, local search"], ["SEO", "catalog copy, feeds, localized pages"]].forEach(([a, b], i) => {
    const x = 150 + (i % 3) * 540, y = 355 + Math.floor(i / 3) * 205;
    addText(s, a, { x, y, w: 350, h: 48 }, { fontFace: "Bahnschrift", size: 22, bold: true, color: i === 4 ? C.bronze2 : C.ivory });
    addLine(s, x, y + 58, 240, i === 4 ? C.bronze : C.muted, 1.5);
    addText(s, b, { x, y: y + 86, w: 410, h: 58 }, { size: 12.5, color: C.soft });
  });
  footer(s, "Джерело: src/app/admin/*; src/app/api/admin/*; src/components/admin/AdminShell.tsx.");
  record(8, { images: [] });

  s = pptx.addSlide();
  beginSlide(9);
  addBg(s, "080808");
  title(s, "Технічна архітектура сучасна і розширювана", "Next.js App Router, React, Tailwind, Prisma і PostgreSQL дають правильний баланс швидкості, SEO та control plane.", 9);
  [["Experience", "Next.js 16 App Router · React 19 · Tailwind · Framer Motion"], ["Business logic", "Server Components first · Route Handlers · Server Actions where existing architecture uses them"], ["Data", "Prisma ORM · PostgreSQL/Supabase · schema.prisma as source of truth"], ["Integrations", "Turn14 · WhitePay · Telegram · Resend · Vercel Blob · Airtable webhooks"]].forEach(([a, b], i) => {
    const y = 338 + i * 130;
    addRect(s, { x: 230, y, w: 1450, h: 82 }, i === 2 ? "221A12" : "131210", i === 2 ? C.bronze : "2B2824");
    addText(s, a, { x: 270, y: y + 22, w: 320, h: 40 }, { fontFace: "Bahnschrift", size: 16, bold: true, color: i === 2 ? C.bronze2 : C.ivory });
    addText(s, b, { x: 635, y: y + 24, w: 965, h: 38 }, { size: 12.5, color: C.soft });
  });
  footer(s, "Джерела: package.json; .agents/PROJECT_CONTEXT.md; src/app/api; prisma/schema.prisma.");
  record(9, { images: [] });

  s = pptx.addSlide();
  beginSlide(10);
  addBg(s);
  title(s, "Що це дає замовнику", "Платформа вже має основу для продажу, операційного контролю й масштабування supplier-driven каталогу.", 10);
  [["Launch-ready storefront", "преміальна вітрина з UA/EN і brand-led каталогом"], ["Operational control", "адмінка, CRM, order flow, логістика, audit-ready data model"], ["Supplier scale", "Turn14 sync + локальна база для пошуку, pricing і маржинальності"], ["Commerce expansion", "WhitePay напрям, B2B approvals, SEO feeds, brand collections"]].forEach(([a, b], i) => {
    const y = 320 + i * 126;
    addText(s, `0${i + 1}`, { x: 145, y, w: 90, h: 54 }, { fontFace: "Bahnschrift", size: 24, bold: true, color: C.bronze2 });
    addText(s, a, { x: 265, y, w: 520, h: 48 }, { fontFace: "Bahnschrift", size: 19, bold: true });
    addText(s, b, { x: 815, y: y + 5, w: 800, h: 44 }, { size: 13.5, color: C.soft });
    addLine(s, 145, y + 78, 1470, "2A2723", 0.6);
  });
  addText(s, "Recommended next decision: freeze launch scope, validate live supplier/payment credentials, and run a production hardening checklist.", { x: 145, y: 870, w: 1370, h: 68 }, { size: 19, color: C.bronze2, bold: true });
  footer(s, "Джерело: поточний код проекту OneCompany та production-hardening docs у docs/superpowers.");
  record(10, { images: [] });

  const deckPath = path.join(OUT, "onecompany-customer-presentation.pptx");
  await pptx.writeFile({ fileName: deckPath });

  for (let i = 1; i <= 10; i++) {
    await renderPreview(i, i === 3 ? C.black : i === 5 ? "0A0B0A" : i === 7 ? "100E0C" : i === 9 ? "080808" : C.obsidian, () => "");
  }

  await fs.writeFile(path.join(SCRATCH, "pptxgen-build-report.json"), JSON.stringify({
    deck: deckPath.replaceAll("\\", "/"),
    previews: Array.from({ length: 10 }, (_, i) => path.join(SCRATCH, `pptxgen-slide-${String(i + 1).padStart(2, "0")}.png`).replaceAll("\\", "/")),
    slideCount: 10,
  }, null, 2));
  console.log(deckPath);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
