import fs from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  text,
  image,
  shape,
  rule,
  fill,
  fixed,
  hug,
  fr,
} from "@oai/artifact-tool";

const ROOT = "D:/OneCompany";
const OUT = "D:/OneCompany/artifacts/customer-presentation/output";
const SCRATCH = "D:/OneCompany/artifacts/customer-presentation/scratch";

const W = 1920;
const H = 1080;
const C = {
  obsidian: "#090909",
  ink: "#12100E",
  graphite: "#1B1A18",
  bronze: "#B08A57",
  bronze2: "#D2B172",
  ivory: "#F2E9D8",
  soft: "#B9B0A3",
  muted: "#746E66",
  red: "#A7342D",
  green: "#6FA47A",
  blue: "#7897B7",
};

const font = {
  display: "Bahnschrift",
  body: "Segoe UI",
};

function abs(p) {
  return path.join(ROOT, p).replaceAll("\\", "/");
}

async function ensureDirs() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(SCRATCH, { recursive: true });
}

function compose(slide, node, frame, baseUnit = 8) {
  slide.compose(node, { frame, baseUnit });
}

function bg(slide, fillColor = C.obsidian) {
  compose(slide, shape({ name: "bg", fill: fillColor, line: { fill: fillColor }, width: fixed(W), height: fixed(H) }), {
    left: 0,
    top: 0,
    width: W,
    height: H,
  });
}

function addImage(slide, name, p, frame, fit = "cover", opacity = 1) {
  compose(slide, image({ name, path: p, fit, alt: name, width: fixed(frame.width), height: fixed(frame.height), opacity }), frame);
}

function addText(slide, value, frame, style = {}, name = "text") {
  compose(
    slide,
    text(value, {
      name,
      width: fixed(frame.width),
      height: hug,
      style: {
        fontFace: font.body,
        fontSize: 30,
        color: C.ivory,
        ...style,
      },
    }),
    frame,
  );
}

function addTitle(slide, title, subtitle, slideNo) {
  addText(
    slide,
    title,
    { left: 110, top: 72, width: 1120, height: 140 },
    { fontFace: font.display, fontSize: 58, bold: true, color: C.ivory },
    "slide-title",
  );
  if (subtitle) {
    addText(
      slide,
      subtitle,
      { left: 112, top: 174, width: 1160, height: 90 },
      { fontSize: 23, color: C.soft },
      "slide-subtitle",
    );
  }
  compose(slide, rule({ name: "title-rule", width: fixed(180), stroke: C.bronze, weight: 4 }), {
    left: 112,
    top: subtitle ? 250 : 172,
    width: 180,
    height: 8,
  });
  addText(
    slide,
    String(slideNo).padStart(2, "0"),
    { left: 1730, top: 78, width: 80, height: 40 },
    { fontFace: font.display, fontSize: 22, color: C.bronze2, align: "right" },
    "slide-number",
  );
}

function addFooter(slide, source = "Джерело: локальний репозиторій OneCompany, PROJECT_CONTEXT, README, prisma/schema.prisma.") {
  addText(
    slide,
    source,
    { left: 112, top: 1014, width: 1390, height: 32 },
    { fontSize: 13, color: C.muted },
    "source-rail",
  );
  addText(
    slide,
    "OneCompany · customer presentation",
    { left: 1510, top: 1014, width: 300, height: 32 },
    { fontSize: 13, color: C.muted, align: "right" },
    "footer-brand",
  );
}

function metric(slide, value, label, x, y, w = 270) {
  addText(slide, value, { left: x, top: y, width: w, height: 80 }, { fontFace: font.display, fontSize: 68, bold: true, color: C.bronze2 }, `metric-${label}`);
  addText(slide, label, { left: x + 4, top: y + 82, width: w, height: 44 }, { fontSize: 20, color: C.soft }, `metric-label-${label}`);
}

function bullet(slide, textValue, x, y, w, accent = C.bronze) {
  compose(slide, shape({ name: `bullet-dot-${y}`, geometry: "ellipse", fill: accent, line: { fill: accent }, width: fixed(12), height: fixed(12) }), {
    left: x,
    top: y + 13,
    width: 12,
    height: 12,
  });
  addText(slide, textValue, { left: x + 28, top: y, width: w, height: 54 }, { fontSize: 25, color: C.ivory }, `bullet-${y}`);
}

function railLabel(slide, label, x, y, color = C.bronze2) {
  addText(slide, label.toUpperCase(), { left: x, top: y, width: 360, height: 30 }, { fontFace: font.display, fontSize: 15, color, bold: true }, `rail-${label}`);
}

function addCover(pres) {
  const s = pres.slides.add();
  bg(s);
  addImage(s, "cover-brabus", abs("public/images/shop/brabus/hq/brabus_gclass_stealth.png"), { left: 960, top: 0, width: 960, height: 1080 });
  compose(s, shape({ name: "cover-scrim", fill: "#090909CC", line: { fill: "#090909CC" }, width: fixed(1180), height: fixed(1080) }), {
    left: 0,
    top: 0,
    width: 1180,
    height: 1080,
  });
  compose(s, shape({ name: "bronze-spine", fill: C.bronze, line: { fill: C.bronze }, width: fixed(10), height: fixed(720) }), {
    left: 102,
    top: 178,
    width: 10,
    height: 720,
  });
  addText(s, "ONECOMPANY", { left: 134, top: 138, width: 540, height: 48 }, { fontFace: font.display, fontSize: 27, color: C.bronze2, bold: true, letterSpacing: 2 }, "cover-brand");
  addText(
    s,
    "Premium automotive commerce platform",
    { left: 132, top: 286, width: 830, height: 210 },
    { fontFace: font.display, fontSize: 76, bold: true, color: C.ivory },
    "cover-title",
  );
  addText(
    s,
    "Storefront, B2B operations, catalog sync, CRM and payments in one operational system.",
    { left: 136, top: 536, width: 760, height: 92 },
    { fontSize: 29, color: C.soft },
    "cover-promise",
  );
  addText(s, "Презентація проекту для замовника · 2026", { left: 136, top: 890, width: 670, height: 34 }, { fontSize: 21, color: C.muted }, "cover-date");
  return s;
}

function addOverview(pres) {
  const s = pres.slides.add();
  bg(s);
  addTitle(s, "Що будує OneCompany", "Преміальна ecommerce та CRM-платформа для авто- і мото performance-напрямку.", 2);
  addImage(s, "adro-preview", abs("adro-catalog-en-desktop.png"), { left: 1010, top: 160, width: 720, height: 500 }, "contain");
  compose(s, shape({ name: "image-frame", fill: "transparent", line: { fill: C.bronze, width: 2 }, width: fixed(720), height: fixed(500) }), { left: 1010, top: 160, width: 720, height: 500 });
  metric(s, "249", "локальних brand definitions", 120, 360);
  metric(s, "UA/EN", "обов'язкова локалізація", 430, 360);
  metric(s, "12", "активних shop image sets", 720, 360);
  bullet(s, "Клієнт бачить premium storefront з реальними брендовими assets.", 120, 610, 760);
  bullet(s, "Команда керує каталогом, цінами, замовленнями, клієнтами й SEO з admin-зони.", 120, 680, 800);
  bullet(s, "Архітектура вже враховує B2C, B2B, Turn14, WhitePay, валютні курси та логістику.", 120, 750, 820);
  addFooter(s, "Джерела: README.md; src/lib/brands.ts; public/images/shop/*; .agents/PROJECT_CONTEXT.md.");
}

function addStorefront(pres) {
  const s = pres.slides.add();
  bg(s, "#0B0A09");
  addTitle(s, "Storefront як вітрина довіри", "Перша цінність для клієнта: брендова подача, локалізована навігація, товарні сторінки і швидкий запит.", 3);
  addImage(s, "akrapovic", abs("public/images/shop/akrapovic/gallery/live/akrapovic-race-car-live.webp"), { left: 110, top: 330, width: 820, height: 330 });
  addImage(s, "girodisc", abs("girodisc_home.png"), { left: 1010, top: 330, width: 700, height: 470 }, "cover");
  railLabel(s, "customer journey", 114, 715);
  bullet(s, "Localized routes under /[locale]/shop, /brands, /categories, /contact.", 116, 765, 760, C.blue);
  bullet(s, "Product detail layouts include media, pricing bands, B2B visibility and request flows.", 116, 830, 830, C.blue);
  railLabel(s, "visual standard", 1016, 835);
  addText(s, "Real official imagery only; no stock filler. Premium automotive luxury: obsidian, bronze, restraint.", { left: 1016, top: 882, width: 710, height: 70 }, { fontSize: 25, color: C.ivory }, "visual-standard");
  addFooter(s, "Джерела: src/app/[locale]/shop; src/app/[locale]/brands; public/images/shop/*.");
}

function addDataModel(pres) {
  const s = pres.slides.add();
  bg(s);
  addTitle(s, "Каталог побудований як операційна база", "Prisma schema фіксує продукт, варіанти, медіа, категорії, колекції, склади, логістику та податки.", 4);
  const y = 360;
  const xs = [145, 465, 785, 1105, 1425];
  const labels = ["Product", "Variant", "Media", "Inventory", "Order"];
  const colors = [C.bronze, C.bronze2, C.blue, C.green, C.red];
  labels.forEach((label, i) => {
    compose(s, shape({ name: `node-${label}`, geometry: "roundRect", fill: i === 0 ? C.bronze : "#171513", line: { fill: colors[i], width: 2 }, width: fixed(230), height: fixed(96) }), {
      left: xs[i],
      top: y + (i % 2) * 85,
      width: 230,
      height: 96,
    });
    addText(s, label, { left: xs[i] + 24, top: y + (i % 2) * 85 + 28, width: 190, height: 40 }, { fontFace: font.display, fontSize: 29, bold: true, color: i === 0 ? C.obsidian : C.ivory, align: "center" }, `node-label-${label}`);
    if (i < labels.length - 1) {
      compose(s, rule({ name: `link-${i}`, width: fixed(108), stroke: C.muted, weight: 3 }), {
        left: xs[i] + 235,
        top: y + 48 + (i % 2) * 85,
        width: 108,
        height: 8,
      });
    }
  });
  bullet(s, "ShopProduct is the source for localized titles, SEO copy, status, brand and base pricing.", 150, 680, 760);
  bullet(s, "ShopProductVariant carries SKU, Turn14 ID/hash, B2B prices, dimensions and inventory relations.", 150, 750, 820);
  bullet(s, "ShopOrder keeps customer snapshot, pricing snapshot, payment status, shipments and status events.", 150, 820, 850);
  addFooter(s, "Джерело: prisma/schema.prisma models ShopProduct, ShopProductVariant, ShopOrder, ShopWarehouse, ShopShippingZone.");
}

function addB2B(pres) {
  const s = pres.slides.add();
  bg(s, "#0A0B0A");
  addTitle(s, "B2B і B2C не змішані", "Платформа відділяє публічну покупку від партнерських умов, approval-логіки і персональних знижок.", 5);
  compose(s, grid({ name: "b2b-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 80 }, [
    column({ name: "b2c-col", width: fill, height: fill, gap: 26 }, [
      text("B2C", { name: "b2c-title", width: fill, height: hug, style: { fontFace: font.display, fontSize: 58, bold: true, color: C.ivory } }),
      rule({ name: "b2c-rule", width: fixed(180), stroke: C.blue, weight: 4 }),
      text("Catalog visibility, cart, localized price display and customer checkout.", { name: "b2c-copy", width: fill, height: hug, style: { fontSize: 30, color: C.soft } }),
      text("UAH / EUR / USD display is computed through currency helpers and runtime rates.", { name: "b2c-proof", width: fill, height: hug, style: { fontSize: 24, color: C.ivory } }),
    ]),
    column({ name: "b2b-col", width: fill, height: fill, gap: 26 }, [
      text("B2B", { name: "b2b-title", width: fill, height: hug, style: { fontFace: font.display, fontSize: 58, bold: true, color: C.bronze2 } }),
      rule({ name: "b2b-rule", width: fixed(180), stroke: C.bronze, weight: 4 }),
      text("Approved-only visibility, account group, company data and customer-specific discount percent.", { name: "b2b-copy", width: fill, height: hug, style: { fontSize: 30, color: C.soft } }),
      text("Admin order creation injects B2B discounts and keeps customer group snapshots.", { name: "b2b-proof", width: fill, height: hug, style: { fontSize: 24, color: C.ivory } }),
    ]),
  ]), { left: 150, top: 350, width: 1520, height: 420 });
  addFooter(s, "Джерела: prisma/schema.prisma ShopSettings/ShopCustomer/ShopOrder; src/app/api/admin/crm; src/lib/shopDisplayPrices.ts.");
}

function addTurn14(pres) {
  const s = pres.slides.add();
  bg(s);
  addTitle(s, "Turn14 інтеграція збережена як supply backbone", "Локальний mirror знімає залежність від зовнішнього пошуку і дає контроль над цінами, брендами та sync-status.", 6);
  const steps = [
    ["Brand lookup", "знаходимо бренд у Turn14"],
    ["Paginated fetch", "витягуємо всі item pages"],
    ["Normalize", "slug, SKU, dimensions, HTML"],
    ["Upsert DB", "ShopProduct + Variant + Media"],
    ["Markup", "brand/customer B2B overrides"],
  ];
  steps.forEach(([a, b], i) => {
    const x = 130 + i * 340;
    addText(s, `0${i + 1}`, { left: x, top: 365, width: 96, height: 70 }, { fontFace: font.display, fontSize: 56, color: C.bronze2, bold: true }, `step-num-${i}`);
    compose(s, rule({ name: `step-rule-${i}`, width: fixed(210), stroke: i % 2 ? C.blue : C.bronze, weight: 3 }), { left: x, top: 446, width: 210, height: 8 });
    addText(s, a, { left: x, top: 482, width: 265, height: 44 }, { fontFace: font.display, fontSize: 29, color: C.ivory, bold: true }, `step-title-${i}`);
    addText(s, b, { left: x, top: 535, width: 255, height: 68 }, { fontSize: 22, color: C.soft }, `step-copy-${i}`);
  });
  addText(s, "Operational point: imported supplier data becomes local commerce data before it reaches customer-facing pages.", { left: 130, top: 760, width: 1240, height: 72 }, { fontSize: 34, color: C.ivory, bold: true }, "turn14-point");
  addFooter(s, "Джерела: src/lib/turn14.ts; src/lib/turn14Sync.ts; src/lib/turn14Pricing.ts; prisma Turn14CatalogItem.");
}

function addPayments(pres) {
  const s = pres.slides.add();
  bg(s, "#100E0C");
  addTitle(s, "Замовлення і платежі вже мають production контур", "Cart → order → payment link → callback/status → admin order management.", 7);
  addImage(s, "brabus-engine", abs("public/images/shop/brabus/hq/brabus_carbon_engine.png"), { left: 1140, top: 210, width: 560, height: 560 });
  const left = 130;
  const lines = [
    ["Cart", "token, locale, currency, cart items"],
    ["Order", "customer snapshot, totals, status events"],
    ["WhitePay", "fiat and crypto order creation routes"],
    ["Admin", "manual order, invoice, payment status"],
  ];
  lines.forEach(([a, b], i) => {
    const y = 330 + i * 120;
    addText(s, a, { left, top: y, width: 230, height: 52 }, { fontFace: font.display, fontSize: 40, bold: true, color: i === 2 ? C.bronze2 : C.ivory }, `pay-title-${i}`);
    compose(s, rule({ name: `pay-link-${i}`, width: fixed(470), stroke: i === 2 ? C.bronze : C.muted, weight: 3 }), { left: left + 245, top: y + 28, width: 470, height: 8 });
    addText(s, b, { left: left + 750, top: y + 2, width: 360, height: 44 }, { fontSize: 24, color: C.soft }, `pay-copy-${i}`);
  });
  addFooter(s, "Джерела: src/lib/shopWhitepay.ts; src/app/api/admin/shop/orders; src/app/api/shop/whitepay; prisma ShopCart/ShopOrder.");
}

function addAdmin(pres) {
  const s = pres.slides.add();
  bg(s);
  addTitle(s, "Admin зона закриває щоденні операції", "Не просто CMS: управління каталогом, цінами, замовленнями, клієнтами, логістикою, SEO і supplier sync.", 8);
  const modules = [
    ["Catalog", "products, variants, media, bundles"],
    ["Orders", "draft/manual orders, status, payments"],
    ["CRM", "customers, B2B groups, discounts"],
    ["Inventory", "stock, warehouses, logistics rules"],
    ["Turn14", "brand markups, sync, local search"],
    ["SEO", "catalog copy, feeds, localized pages"],
  ];
  modules.forEach(([a, b], i) => {
    const col = i % 3;
    const rowN = Math.floor(i / 3);
    const x = 150 + col * 540;
    const y = 355 + rowN * 205;
    addText(s, a, { left: x, top: y, width: 350, height: 48 }, { fontFace: font.display, fontSize: 38, color: i === 4 ? C.bronze2 : C.ivory, bold: true }, `admin-title-${i}`);
    compose(s, rule({ name: `admin-rule-${i}`, width: fixed(240), stroke: i === 4 ? C.bronze : C.muted, weight: 3 }), { left: x, top: y + 58, width: 240, height: 8 });
    addText(s, b, { left: x, top: y + 86, width: 410, height: 58 }, { fontSize: 23, color: C.soft }, `admin-copy-${i}`);
  });
  addFooter(s, "Джерело: src/app/admin/*; src/app/api/admin/*; src/components/admin/AdminShell.tsx.");
}

function addArchitecture(pres) {
  const s = pres.slides.add();
  bg(s, "#080808");
  addTitle(s, "Технічна архітектура сучасна і розширювана", "Next.js App Router, React, Tailwind, Prisma і PostgreSQL дають правильний баланс швидкості, SEO та control plane.", 9);
  const bands = [
    ["Experience", "Next.js 16 App Router · React 19 · Tailwind · Framer Motion"],
    ["Business logic", "Server Components first · Route Handlers · Server Actions where existing architecture uses them"],
    ["Data", "Prisma ORM · PostgreSQL/Supabase · schema.prisma as source of truth"],
    ["Integrations", "Turn14 · WhitePay · Telegram · Resend · Vercel Blob · Airtable webhooks"],
  ];
  bands.forEach(([a, b], i) => {
    const y = 338 + i * 130;
    compose(s, shape({ name: `arch-band-${i}`, fill: i === 2 ? "#221A12" : "#131210", line: { fill: i === 2 ? C.bronze : "#2B2824", width: 1 }, width: fixed(1450), height: fixed(82) }), {
      left: 230,
      top: y,
      width: 1450,
      height: 82,
    });
    addText(s, a, { left: 270, top: y + 22, width: 320, height: 40 }, { fontFace: font.display, fontSize: 28, color: i === 2 ? C.bronze2 : C.ivory, bold: true }, `arch-title-${i}`);
    addText(s, b, { left: 635, top: y + 24, width: 965, height: 38 }, { fontSize: 23, color: C.soft }, `arch-copy-${i}`);
  });
  addFooter(s, "Джерела: package.json; .agents/PROJECT_CONTEXT.md; src/app/api; prisma/schema.prisma.");
}

function addRoadmap(pres) {
  const s = pres.slides.add();
  bg(s);
  addTitle(s, "Що це дає замовнику", "Платформа вже має основу для продажу, операційного контролю й масштабування supplier-driven каталогу.", 10);
  const items = [
    ["Launch-ready storefront", "преміальна вітрина з UA/EN і brand-led каталогом"],
    ["Operational control", "адмінка, CRM, order flow, логістика, audit-ready data model"],
    ["Supplier scale", "Turn14 sync + локальна база для пошуку, pricing і маржинальності"],
    ["Commerce expansion", "WhitePay напрям, B2B approvals, SEO feeds, brand collections"],
  ];
  items.forEach(([a, b], i) => {
    const y = 320 + i * 126;
    addText(s, `0${i + 1}`, { left: 145, top: y, width: 90, height: 54 }, { fontFace: font.display, fontSize: 42, bold: true, color: C.bronze2 }, `road-num-${i}`);
    addText(s, a, { left: 265, top: y, width: 520, height: 48 }, { fontFace: font.display, fontSize: 34, bold: true, color: C.ivory }, `road-title-${i}`);
    addText(s, b, { left: 815, top: y + 5, width: 800, height: 44 }, { fontSize: 24, color: C.soft }, `road-copy-${i}`);
    compose(s, rule({ name: `road-rule-${i}`, width: fixed(1470), stroke: "#2A2723", weight: 1 }), { left: 145, top: y + 78, width: 1470, height: 4 });
  });
  addText(s, "Recommended next decision: freeze launch scope, validate live supplier/payment credentials, and run a production hardening checklist.", { left: 145, top: 870, width: 1370, height: 68 }, { fontSize: 33, color: C.bronze2, bold: true }, "final-recommendation");
  addFooter(s, "Джерело: поточний код проекту OneCompany та production-hardening docs у docs/superpowers.");
}

async function saveBlob(blob, filePath) {
  const buf = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(filePath, buf);
}

async function exportPreviews(pres, prefix = "onecompany") {
  const paths = [];
  for (let i = 0; i < pres.slides.count; i++) {
    const slide = pres.slides.getItem(i);
    const png = await slide.export({ format: "png" });
    const out = path.join(SCRATCH, `${prefix}-slide-${String(i + 1).padStart(2, "0")}.png`);
    await saveBlob(png, out);
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(SCRATCH, `${prefix}-slide-${String(i + 1).padStart(2, "0")}.layout.json`), JSON.stringify(layout, null, 2), "utf8");
    paths.push(out.replaceAll("\\", "/"));
  }
  return paths;
}

async function build() {
  await ensureDirs();
  const pres = Presentation.create({ slideSize: { width: W, height: H } });
  addCover(pres);
  addOverview(pres);
  addStorefront(pres);
  addDataModel(pres);
  addB2B(pres);
  addTurn14(pres);
  addPayments(pres);
  addAdmin(pres);
  addArchitecture(pres);
  addRoadmap(pres);

  const pptx = await PresentationFile.exportPptx(pres);
  const pptxPath = path.join(OUT, "onecompany-customer-presentation.pptx");
  await pptx.save(pptxPath);
  const previews = await exportPreviews(pres, "onecompany");
  const report = {
    deck: pptxPath.replaceAll("\\", "/"),
    previews,
    slideCount: pres.slides.count,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(SCRATCH, "build-report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
