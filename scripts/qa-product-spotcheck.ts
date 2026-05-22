/**
 * QA: spot-check 5 random products from each of 12 brand stores.
 * Verifies: title (UA+EN), description (UA+EN), price > 0, image presence,
 * publicly reachable URL returns 200 with title and price in HTML.
 *
 * Read-only against DB.
 * Output: artifacts/qa-2026-05-13/data/product-spotcheck.csv (+ .json)
 */
import { PrismaClient, ShopProduct, ShopProductMedia, ShopProductVariant } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { FORGED_DESIGNS } from "../src/data/forgedDesigns";

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "..");
const OUT_CSV = path.join(ROOT, "artifacts/qa-2026-05-13/data/product-spotcheck.csv");
const OUT_JSON = path.join(ROOT, "artifacts/qa-2026-05-13/data/product-spotcheck.json");
const BASE = process.env.QA_BASE_URL || "http://localhost:3000";

const STORES: Array<{ slug: string; brandField?: string; source: "brand" | "urban" | "forged" }> = [
  { slug: "adro", brandField: "ADRO", source: "brand" },
  { slug: "akrapovic", brandField: "AKRAPOVIC", source: "brand" },
  { slug: "brabus", brandField: "Brabus", source: "brand" },
  { slug: "burger", brandField: "Burger Motorsports", source: "brand" },
  { slug: "csf", brandField: "CSF", source: "brand" },
  { slug: "do88", brandField: "DO88", source: "brand" },
  { slug: "forged", source: "forged" },
  { slug: "girodisc", brandField: "GiroDisc", source: "brand" },
  { slug: "ipe", brandField: "iPE exhaust", source: "brand" },
  { slug: "ohlins", brandField: "OHLINS", source: "brand" },
  { slug: "racechip", brandField: "RaceChip", source: "brand" },
  { slug: "urban", source: "urban" },
];

const SEED = 20260513;
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

interface Issue {
  field: string;
  detail: string;
}
interface CheckRow {
  store: string;
  source: string;
  productId: string;
  sku: string;
  slug: string;
  url: string;
  titleUa: string;
  titleEn: string;
  hasShortDescUa: boolean;
  hasShortDescEn: boolean;
  hasLongOrBodyUa: boolean;
  hasLongOrBodyEn: boolean;
  priceEur: number | null;
  priceUah: number | null;
  hasImage: boolean;
  imageCount: number;
  httpStatus: number | null;
  htmlHasTitle: boolean | null;
  htmlHasPrice: boolean | null;
  pass: boolean;
  issues: Issue[];
}

async function checkOneDbProduct(
  product: ShopProduct & { media: ShopProductMedia[]; variants: ShopProductVariant[] },
  store: string,
  source: string
): Promise<CheckRow> {
  const issues: Issue[] = [];

  const titleUa = product.titleUa || "";
  const titleEn = product.titleEn || "";
  if (!titleUa.trim()) issues.push({ field: "titleUa", detail: "empty" });
  else if (titleUa.length < 3)
    issues.push({ field: "titleUa", detail: `too short (${titleUa.length})` });
  if (!titleEn.trim()) issues.push({ field: "titleEn", detail: "empty" });
  else if (titleEn.length < 3)
    issues.push({ field: "titleEn", detail: `too short (${titleEn.length})` });

  const hasShortUa = !!product.shortDescUa?.trim();
  const hasShortEn = !!product.shortDescEn?.trim();
  const hasLongUa = !!(product.longDescUa?.trim() || product.bodyHtmlUa?.trim());
  const hasLongEn = !!(product.longDescEn?.trim() || product.bodyHtmlEn?.trim());

  if (!hasShortUa && !hasLongUa)
    issues.push({ field: "descUa", detail: "no UA description (short/long/body all empty)" });
  if (!hasShortEn && !hasLongEn)
    issues.push({ field: "descEn", detail: "no EN description (short/long/body all empty)" });

  // pick best price (prefer product-level, fallback to first variant). Check ALL 3 currencies.
  const numOrNull = (v: any) => (v === null || v === undefined ? null : Number(v));
  let priceEur = numOrNull(product.priceEur);
  let priceUah = numOrNull(product.priceUah);
  let priceUsd = numOrNull((product as any).priceUsd);
  if (priceEur === null && product.variants.length)
    priceEur = numOrNull(product.variants[0].priceEur);
  if (priceUah === null && product.variants.length)
    priceUah = numOrNull(product.variants[0].priceUah);
  if (priceUsd === null && product.variants.length)
    priceUsd = numOrNull((product.variants[0] as any).priceUsd);

  const hasAnyPrice =
    (priceEur !== null && priceEur > 0) ||
    (priceUah !== null && priceUah > 0) ||
    (priceUsd !== null && priceUsd > 0);
  if (!hasAnyPrice) {
    issues.push({
      field: "price",
      detail: `no positive price (EUR=${priceEur}, UAH=${priceUah}, USD=${priceUsd})`,
    });
  }

  const hasImage = product.media.length > 0 || !!product.image;
  if (!hasImage) issues.push({ field: "image", detail: "no media records and no image field" });

  const slug = product.slug;
  const url = `${BASE}/ua/shop/${store}/products/${slug}`;

  let httpStatus: number | null = null;
  let htmlHasTitle: boolean | null = null;
  let htmlHasPrice: boolean | null = null;

  try {
    const res = await fetch(url, { redirect: "manual" });
    httpStatus = res.status;
    if (res.status >= 200 && res.status < 400) {
      const html = await res.text();
      const titleProbe = titleUa.slice(0, 20) || titleEn.slice(0, 20);
      htmlHasTitle = titleProbe ? html.toLowerCase().includes(titleProbe.toLowerCase()) : false;
      // Try any of the 3 currencies that have a price — pick the first non-null.
      const priceProbe =
        (priceUah ? Math.floor(priceUah).toString() : "") ||
        (priceEur ? Math.floor(priceEur).toString() : "") ||
        (priceUsd ? Math.floor(priceUsd).toString() : "");
      htmlHasPrice = priceProbe ? html.includes(priceProbe) : false;
      if (!htmlHasTitle)
        issues.push({ field: "page", detail: `title "${titleProbe}" not found in HTML` });
      if (!htmlHasPrice && priceProbe)
        issues.push({ field: "page", detail: `price ${priceProbe} not found in HTML` });
    } else {
      issues.push({ field: "page", detail: `HTTP ${res.status}` });
    }
  } catch (err) {
    issues.push({
      field: "page",
      detail: `fetch error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return {
    store,
    source,
    productId: product.id,
    sku: product.sku || "",
    slug,
    url,
    titleUa,
    titleEn,
    hasShortDescUa: hasShortUa,
    hasShortDescEn: hasShortEn,
    hasLongOrBodyUa: hasLongUa,
    hasLongOrBodyEn: hasLongEn,
    priceEur,
    priceUah,
    hasImage,
    imageCount: product.media.length,
    httpStatus,
    htmlHasTitle,
    htmlHasPrice,
    pass: issues.length === 0,
    issues,
  };
}

async function checkForgedDesign(design: any): Promise<CheckRow> {
  const issues: Issue[] = [];
  const slug = design.slug;
  const url = `${BASE}/ua/shop/forged/products/${slug}`;
  // Forged catalog uses nameUa/nameEn (title) and taglineUa/taglineEn (description), heroImage + gallery.
  const titleUa = design.nameUa || "";
  const titleEn = design.nameEn || "";
  if (!titleUa) issues.push({ field: "nameUa", detail: "missing in static catalog" });
  if (!titleEn) issues.push({ field: "nameEn", detail: "missing in static catalog" });
  const hasDescUa = !!design.taglineUa;
  const hasDescEn = !!design.taglineEn;
  if (!hasDescUa) issues.push({ field: "taglineUa", detail: "empty" });
  if (!hasDescEn) issues.push({ field: "taglineEn", detail: "empty" });
  const hasImage =
    !!design.heroImage || (Array.isArray(design.gallery) && design.gallery.length > 0);
  if (!hasImage) issues.push({ field: "image", detail: "no heroImage or gallery" });
  if (!design.basePriceEur || design.basePriceEur <= 0) {
    issues.push({ field: "price", detail: `basePriceEur=${design.basePriceEur}` });
  }

  let httpStatus: number | null = null;
  let htmlHasTitle: boolean | null = null;
  try {
    const res = await fetch(url, { redirect: "manual" });
    httpStatus = res.status;
    if (res.status >= 200 && res.status < 400) {
      const html = await res.text();
      const probe = (titleUa || titleEn).slice(0, 20);
      htmlHasTitle = probe ? html.toLowerCase().includes(probe.toLowerCase()) : false;
      if (!htmlHasTitle) issues.push({ field: "page", detail: `title "${probe}" not in HTML` });
    } else {
      issues.push({ field: "page", detail: `HTTP ${res.status}` });
    }
  } catch (err) {
    issues.push({
      field: "page",
      detail: `fetch error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return {
    store: "forged",
    source: "forged",
    productId: design.id || design.slug,
    sku: design.sku || "",
    slug,
    url,
    titleUa,
    titleEn,
    hasShortDescUa: hasDescUa,
    hasShortDescEn: hasDescEn,
    hasLongOrBodyUa: hasDescUa,
    hasLongOrBodyEn: hasDescEn,
    priceEur: design.basePriceEur ?? null,
    priceUah: null,
    hasImage,
    imageCount: Array.isArray(design.gallery) ? design.gallery.length : hasImage ? 1 : 0,
    httpStatus,
    htmlHasTitle,
    htmlHasPrice: null,
    pass: issues.length === 0,
    issues,
  };
}

(async () => {
  const rng = mulberry32(SEED);
  const rows: CheckRow[] = [];

  for (const store of STORES) {
    console.log(`\n[${store.slug}] (${store.source})`);

    if (store.source === "forged") {
      const visibleDesigns = FORGED_DESIGNS.filter((d: any) => d.isCatalogVisible !== false);
      const picks = pickRandom(visibleDesigns, 5, rng);
      console.log(`  picked ${picks.length} forged designs from ${visibleDesigns.length} visible`);
      for (const d of picks) {
        const row = await checkForgedDesign(d);
        rows.push(row);
        console.log(
          `    ${row.pass ? "OK" : "FAIL"}  ${row.slug}  ${row.issues.map((i) => i.field).join(",") || ""}`
        );
      }
      continue;
    }

    let products: any[];
    if (store.source === "urban") {
      products = await prisma.shopProduct.findMany({
        where: {
          status: "ACTIVE",
          isPublished: true,
          collections: { some: { collection: { isUrban: true } } },
        },
        include: { media: true, variants: { where: { isDefault: true }, take: 1 } },
        take: 200,
      });
    } else {
      products = await prisma.shopProduct.findMany({
        where: {
          status: "ACTIVE",
          isPublished: true,
          brand: store.brandField,
        },
        include: { media: true, variants: { where: { isDefault: true }, take: 1 } },
        take: 500,
      });
    }
    console.log(`  pool size: ${products.length}`);
    const picks = pickRandom(products, 5, rng);
    console.log(`  picked ${picks.length}`);
    for (const p of picks) {
      const row = await checkOneDbProduct(p, store.slug, store.source);
      rows.push(row);
      console.log(
        `    ${row.pass ? "OK" : "FAIL"}  ${row.sku || row.slug}  ${row.issues.map((i) => i.field).join(",") || ""}`
      );
    }
  }

  // CSV
  const esc = (s: any) => {
    const str = s === null || s === undefined ? "" : String(s);
    return '"' + str.replace(/"/g, '""') + '"';
  };
  const header = [
    "store",
    "source",
    "productId",
    "sku",
    "slug",
    "url",
    "titleUa",
    "titleEn",
    "hasShortDescUa",
    "hasShortDescEn",
    "hasLongOrBodyUa",
    "hasLongOrBodyEn",
    "priceEur",
    "priceUah",
    "hasImage",
    "imageCount",
    "httpStatus",
    "htmlHasTitle",
    "htmlHasPrice",
    "pass",
    "issuesCount",
    "issues",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.store,
      r.source,
      r.productId,
      esc(r.sku),
      esc(r.slug),
      esc(r.url),
      esc(r.titleUa),
      esc(r.titleEn),
      r.hasShortDescUa,
      r.hasShortDescEn,
      r.hasLongOrBodyUa,
      r.hasLongOrBodyEn,
      r.priceEur ?? "",
      r.priceUah ?? "",
      r.hasImage,
      r.imageCount,
      r.httpStatus ?? "",
      r.htmlHasTitle ?? "",
      r.htmlHasPrice ?? "",
      r.pass,
      r.issues.length,
      esc(r.issues.map((i) => `${i.field}:${i.detail}`).join(" | ")),
    ].join(",")
  );
  await fs.mkdir(path.dirname(OUT_CSV), { recursive: true });
  await fs.writeFile(OUT_CSV, [header, ...lines].join("\n"), "utf8");
  await fs.writeFile(OUT_JSON, JSON.stringify(rows, null, 2), "utf8");

  const passed = rows.filter((r) => r.pass).length;
  const failed = rows.length - passed;
  console.log(`\n[product-spotcheck] total=${rows.length} pass=${passed} fail=${failed}`);
  console.log(`  CSV:  ${OUT_CSV}`);
  console.log(`  JSON: ${OUT_JSON}`);
  await prisma.$disconnect();
})();
