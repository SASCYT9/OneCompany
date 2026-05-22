/**
 * QA: scrape original brand websites and compare prices with our DB.
 *
 * Methodology:
 *   - Sample 5 ACTIVE+published products per brand (seed=20260513, same as spot-check).
 *   - For each brand we know the source-site search/PDP pattern. Try search by SKU,
 *     extract price via DOM/regex, take a screenshot as evidence.
 *   - Many brands DO NOT publish list prices (quote-only via dealer). Those are
 *     flagged "no-public-price" rather than treated as failures.
 *
 * Output:
 *   artifacts/qa-2026-05-13/data/price-comparison.csv (+ .json)
 *   artifacts/qa-2026-05-13/source-screenshots/<brand>__<sku>.png
 */
import { PrismaClient } from "@prisma/client";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "artifacts/qa-2026-05-13/source-screenshots");
const DATA = path.join(ROOT, "artifacts/qa-2026-05-13/data");

interface BrandConfig {
  slug: string;
  brandField?: string;
  source: "brand" | "urban";
  /** Strategy: 'search' = search URL with SKU, 'shopify-handle' = product handle, 'none' = no public price */
  strategy: "search" | "shopify-handle" | "none";
  searchUrl?: (sku: string) => string;
  /** Selectors to try in order */
  priceSelectors?: string[];
  /** Currency the site shows */
  currency?: "USD" | "EUR" | "GBP" | "SEK";
  reason?: string;
}

const BRANDS: BrandConfig[] = [
  {
    slug: "racechip",
    brandField: "RaceChip",
    source: "brand",
    strategy: "search",
    searchUrl: (sku) =>
      `https://www.racechip.de/search?q=${encodeURIComponent(sku.replace("RC-GTS5-", "").replace(/-/g, " "))}`,
    priceSelectors: ['[itemprop="price"]', ".price", ".product-price", "[data-price]"],
    currency: "EUR",
  },
  {
    slug: "csf",
    brandField: "CSF",
    source: "brand",
    strategy: "search",
    searchUrl: (sku) => `https://csfrace.com/?s=${encodeURIComponent(sku)}&post_type=product`,
    priceSelectors: [".price .woocommerce-Price-amount", ".price", '[itemprop="price"]'],
    currency: "USD",
  },
  {
    slug: "do88",
    brandField: "DO88",
    source: "brand",
    strategy: "search",
    searchUrl: (sku) => `https://www.do88.se/en/sok?q=${encodeURIComponent(sku)}`,
    priceSelectors: [".price", '[itemprop="price"]', ".product-price"],
    currency: "EUR",
  },
  {
    slug: "girodisc",
    brandField: "GiroDisc",
    source: "brand",
    strategy: "search",
    searchUrl: (sku) =>
      `https://www.girodisc.com/catalogsearch/result/?q=${encodeURIComponent(sku)}`,
    priceSelectors: [".price-wrapper .price", ".price", "[data-price-amount]"],
    currency: "USD",
  },
  {
    slug: "adro",
    brandField: "ADRO",
    source: "brand",
    strategy: "search",
    searchUrl: (sku) => `https://adrocarbon.com/search?q=${encodeURIComponent(sku)}`,
    priceSelectors: [".price-item--regular", ".product__price", ".price", "[data-product-price]"],
    currency: "USD",
  },
  {
    slug: "burger",
    brandField: "Burger Motorsports",
    source: "brand",
    strategy: "search",
    // Burger SKUs in our DB are "BURGER-<shopifyVariantId>" — actual site has no such mapping.
    // Try search by product name instead (passed below).
    searchUrl: (sku) =>
      `https://burgertuning.com/search?q=${encodeURIComponent(sku.replace("BURGER-", ""))}`,
    priceSelectors: [".price-item--regular", ".product__price", ".price", "[data-product-price]"],
    currency: "USD",
  },
  // No public list prices — quote-only via dealer
  {
    slug: "akrapovic",
    brandField: "AKRAPOVIC",
    source: "brand",
    strategy: "none",
    reason: "Akrapovic publishes prices via authorized dealers only; akrapovic.com has no e-comm.",
  },
  {
    slug: "brabus",
    brandField: "Brabus",
    source: "brand",
    strategy: "none",
    reason: "Brabus components are sold via Brabus Tuning Centers; prices are quote-only.",
  },
  {
    slug: "ohlins",
    brandField: "OHLINS",
    source: "brand",
    strategy: "none",
    reason: "Öhlins prices vary by regional distributor; ohlins.com is informational.",
  },
  {
    slug: "ipe",
    brandField: "iPE exhaust",
    source: "brand",
    strategy: "none",
    reason:
      "iPE F1 Innotech distributes via regional dealers; ipe-f1.com lists products without prices.",
  },
  {
    slug: "urban",
    source: "urban",
    strategy: "none",
    reason: "Urban Automotive is quote-only (urbanautomotive.eu shows products without prices).",
  },
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
function pick<T>(arr: T[], n: number, rng: () => number): T[] {
  const c = [...arr];
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rng() * c.length), 1)[0]);
  return out;
}

interface Row {
  brand: string;
  sku: string;
  slug: string;
  title: string;
  ourPriceUsd: number | null;
  ourPriceEur: number | null;
  sourceUrl: string;
  sourcePriceRaw: string | null;
  sourcePriceNum: number | null;
  sourceCurrency: string | null;
  matchOk: boolean;
  deltaPct: number | null;
  status: "compared" | "no-public-price" | "no-match" | "fetch-error" | "product-not-found";
  note: string;
}

function parsePrice(raw: string | null | undefined): { num: number | null; cur: string | null } {
  if (!raw) return { num: null, cur: null };
  const s = raw.replace(/\s+/g, " ").trim();
  // detect currency token
  let cur: string | null = null;
  if (/€|EUR/i.test(s)) cur = "EUR";
  else if (/\$|USD/i.test(s)) cur = "USD";
  else if (/£|GBP/i.test(s)) cur = "GBP";
  else if (/SEK|kr\b/i.test(s)) cur = "SEK";
  // grab the first numeric value (allow . and , separators)
  const m = s.match(/[\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?/);
  if (!m) return { num: null, cur };
  let numStr = m[0];
  // normalize: remove spaces, decide if last . or , is decimal
  numStr = numStr.replace(/\s/g, "");
  const lastDot = numStr.lastIndexOf(".");
  const lastComma = numStr.lastIndexOf(",");
  if (lastDot === -1 && lastComma === -1) return { num: parseFloat(numStr), cur };
  // last separator is decimal if followed by 2 digits, thousands otherwise
  const lastSep = Math.max(lastDot, lastComma);
  const tail = numStr.length - lastSep - 1;
  const sep = numStr[lastSep];
  if (tail === 2) {
    // decimal
    numStr = numStr.replace(/[.,]/g, (c, i) => (i === lastSep ? "." : ""));
  } else {
    // thousands only
    numStr = numStr.replace(/[.,]/g, "");
  }
  return { num: parseFloat(numStr), cur };
}

// Rough FX for sanity check (mid-2026 placeholders; we report raw numbers & flag big deltas).
const FX = { USD: 1.0, EUR: 1.08, GBP: 1.27, SEK: 0.094 };
function toUsd(n: number, cur: string): number {
  return n * (FX[cur as keyof typeof FX] ?? 1);
}

async function scrapeOne(
  page: Page,
  brand: BrandConfig,
  sku: string,
  title: string
): Promise<{
  url: string;
  priceRaw: string | null;
  priceNum: number | null;
  currency: string | null;
  status: Row["status"];
  note: string;
}> {
  if (brand.strategy === "none" || !brand.searchUrl) {
    return {
      url: "",
      priceRaw: null,
      priceNum: null,
      currency: null,
      status: "no-public-price",
      note: brand.reason ?? "",
    };
  }
  const url = brand.searchUrl(sku);
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    if (!resp || resp.status() >= 400) {
      return {
        url,
        priceRaw: null,
        priceNum: null,
        currency: null,
        status: "fetch-error",
        note: `HTTP ${resp?.status() ?? "no-response"}`,
      };
    }
    await page.waitForTimeout(2000);

    // First, check the search-results page if there are no results
    const bodyText = (
      await page.evaluate(() => document.body.innerText.slice(0, 5000))
    ).toLowerCase();
    const noResults =
      /no results|нічого не знайдено|нет результатов|no products|niente trovato|0 products|0 результати/.test(
        bodyText
      );
    if (noResults && !brand.priceSelectors?.some((s) => false)) {
      return {
        url,
        priceRaw: null,
        priceNum: null,
        currency: null,
        status: "product-not-found",
        note: "search returned no results",
      };
    }

    // Try to find first product result link and click it (search pages usually need a click-through)
    // but we can also try to extract the first price right from the listing.
    let raw: string | null = null;
    for (const sel of brand.priceSelectors ?? []) {
      try {
        const el = await page.$(sel);
        if (el) {
          const text = (await el.textContent()) ?? "";
          if (text.trim()) {
            raw = text.trim();
            break;
          }
        }
      } catch {}
    }

    // If no price on search-results page, click first product link and try again
    if (!raw) {
      try {
        // common product-card link selectors
        const candidates = [
          "a.product-card",
          "a.product-item",
          ".product-grid a",
          ".products-grid a",
          ".product a",
          'a[href*="/products/"]',
          "a.woocommerce-LoopProduct-link",
        ];
        for (const c of candidates) {
          const link = await page.$(c);
          if (link) {
            const href = await link.getAttribute("href");
            if (href) {
              const target = href.startsWith("http") ? href : new URL(href, url).toString();
              await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
              await page.waitForTimeout(1500);
              for (const sel of brand.priceSelectors ?? []) {
                try {
                  const el = await page.$(sel);
                  if (el) {
                    const text = (await el.textContent()) ?? "";
                    if (text.trim()) {
                      raw = text.trim();
                      break;
                    }
                  }
                } catch {}
              }
              break;
            }
          }
        }
      } catch {}
    }

    if (!raw) {
      return {
        url: page.url(),
        priceRaw: null,
        priceNum: null,
        currency: null,
        status: "no-match",
        note: "no price element found",
      };
    }
    const parsed = parsePrice(raw);
    return {
      url: page.url(),
      priceRaw: raw.slice(0, 80),
      priceNum: parsed.num,
      currency: parsed.cur ?? brand.currency ?? null,
      status: "compared",
      note: "",
    };
  } catch (err: any) {
    return {
      url,
      priceRaw: null,
      priceNum: null,
      currency: null,
      status: "fetch-error",
      note: err?.message?.slice(0, 200) ?? String(err),
    };
  }
}

async function fetchSamplesWithRetry(): Promise<Record<string, any[]>> {
  const rng = mulberry32(SEED);
  const result: Record<string, any[]> = {};
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      for (const brand of BRANDS) {
        let products: any[];
        if (brand.source === "urban") {
          products = await prisma.shopProduct.findMany({
            where: {
              status: "ACTIVE",
              isPublished: true,
              collections: { some: { collection: { isUrban: true } } },
            },
            select: {
              sku: true,
              slug: true,
              titleEn: true,
              titleUa: true,
              priceEur: true,
              priceUsd: true,
              variants: {
                where: { isDefault: true },
                take: 1,
                select: { priceEur: true, priceUsd: true },
              },
            },
            take: 200,
          });
        } else {
          products = await prisma.shopProduct.findMany({
            where: { status: "ACTIVE", isPublished: true, brand: brand.brandField },
            select: {
              sku: true,
              slug: true,
              titleEn: true,
              titleUa: true,
              priceEur: true,
              priceUsd: true,
              variants: {
                where: { isDefault: true },
                take: 1,
                select: { priceEur: true, priceUsd: true },
              },
            },
            take: 500,
          });
        }
        result[brand.slug] = pick(products, 5, rng);
      }
      return result;
    } catch (err: any) {
      if (/too many connections/i.test(err?.message ?? "") && attempt < maxAttempts) {
        const wait = 15000 * attempt;
        console.log(`  DB busy (attempt ${attempt}/${maxAttempts}) — sleeping ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed after retries");
}

(async () => {
  await fs.mkdir(SHOTS, { recursive: true });
  const rows: Row[] = [];

  console.log("[1/2] Loading product samples from existing spot-check artifact...");
  // Reuse same 60 SKU (same seed=20260513) from product-spotcheck.json — avoids DB pressure.
  const spotcheckPath = path.join(DATA, "product-spotcheck.json");
  const spotcheck: any[] = JSON.parse(await fs.readFile(spotcheckPath, "utf8"));
  const samples: Record<string, any[]> = {};
  for (const b of BRANDS) samples[b.slug] = [];
  for (const r of spotcheck) {
    if (!samples[r.store]) continue;
    samples[r.store].push({
      sku: r.sku,
      slug: r.slug,
      titleEn: r.titleEn,
      titleUa: r.titleUa,
      priceEur: r.priceEur,
      priceUsd: null, // not in spotcheck output — derive on the fly later if needed
      variants: [],
    });
  }
  // To recover USD prices (which spotcheck didn't surface), need a quick DB pass. Try once with retry.
  console.log("  fetching USD prices for the same SKUs (single retry on busy)...");
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const allSkus = Array.from(new Set(spotcheck.map((r: any) => r.sku).filter((s: any) => s)));
      const usdRows = await prisma.shopProduct.findMany({
        where: { sku: { in: allSkus as string[] } },
        select: {
          sku: true,
          priceUsd: true,
          variants: { where: { isDefault: true }, take: 1, select: { priceUsd: true } },
        },
      });
      const usdBySku: Record<string, number | null> = {};
      for (const u of usdRows) {
        const v =
          u.priceUsd != null
            ? Number(u.priceUsd)
            : u.variants[0]?.priceUsd != null
              ? Number(u.variants[0].priceUsd)
              : null;
        if (u.sku) usdBySku[u.sku] = v;
      }
      for (const slug of Object.keys(samples)) {
        for (const p of samples[slug]) {
          if (p.sku && usdBySku[p.sku] != null) p.priceUsd = usdBySku[p.sku];
        }
      }
      console.log(`  enriched ${usdRows.length} SKUs with USD prices`);
      break;
    } catch (err: any) {
      if (/too many connections/i.test(err?.message ?? "") && attempt < 5) {
        const wait = 20000 * attempt;
        console.log(`  DB busy (${attempt}/5) — sleeping ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        console.log(
          `  USD enrichment failed — falling back to EUR×FX only (${err?.message?.slice(0, 100) ?? err}).`
        );
        break;
      }
    }
  }
  await prisma.$disconnect();
  console.log("  DB disconnected. Starting scraping phase.\n");
  void fetchSamplesWithRetry;

  const browser: Browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    locale: "en-US",
  });

  for (const brand of BRANDS) {
    console.log(`\n=== ${brand.slug.toUpperCase()} (${brand.strategy}) ===`);
    const picks = samples[brand.slug] ?? [];
    console.log(`  picked=${picks.length}`);

    for (const p of picks) {
      const ourEur =
        p.priceEur != null
          ? Number(p.priceEur)
          : p.variants[0]?.priceEur != null
            ? Number(p.variants[0].priceEur)
            : null;
      const ourUsd =
        p.priceUsd != null
          ? Number(p.priceUsd)
          : p.variants[0]?.priceUsd != null
            ? Number(p.variants[0].priceUsd)
            : null;

      if (brand.strategy === "none") {
        rows.push({
          brand: brand.slug,
          sku: p.sku ?? "",
          slug: p.slug,
          title: (p.titleEn || p.titleUa).slice(0, 80),
          ourPriceUsd: ourUsd,
          ourPriceEur: ourEur,
          sourceUrl: "",
          sourcePriceRaw: null,
          sourcePriceNum: null,
          sourceCurrency: null,
          matchOk: false,
          deltaPct: null,
          status: "no-public-price",
          note: brand.reason ?? "",
        });
        console.log(`  ${p.sku ?? p.slug}  → SKIP (${brand.reason})`);
        continue;
      }

      const page = await ctx.newPage();
      const result = await scrapeOne(page, brand, p.sku || p.slug, p.titleEn || p.titleUa);

      // screenshot evidence
      try {
        const safeSku = (p.sku || p.slug).replace(/[^a-z0-9-]/gi, "_").slice(0, 60);
        await page.screenshot({
          path: path.join(SHOTS, `${brand.slug}__${safeSku}.png`),
          fullPage: false,
        });
      } catch {}
      await page.close();

      let matchOk = false;
      let deltaPct: number | null = null;
      if (result.status === "compared" && result.priceNum != null && result.currency) {
        const sourceUsd = toUsd(result.priceNum, result.currency);
        const ourUsdEff = ourUsd ?? (ourEur != null ? ourEur * FX.EUR : null);
        if (ourUsdEff != null && ourUsdEff > 0) {
          deltaPct = ((ourUsdEff - sourceUsd) / sourceUsd) * 100;
          matchOk = Math.abs(deltaPct) <= 25; // within 25% is "reasonable" given FX + markup
        }
      }

      rows.push({
        brand: brand.slug,
        sku: p.sku ?? "",
        slug: p.slug,
        title: (p.titleEn || p.titleUa).slice(0, 80),
        ourPriceUsd: ourUsd,
        ourPriceEur: ourEur,
        sourceUrl: result.url,
        sourcePriceRaw: result.priceRaw,
        sourcePriceNum: result.priceNum,
        sourceCurrency: result.currency,
        matchOk,
        deltaPct,
        status: result.status,
        note: result.note,
      });
      const ours = ourUsd ?? (ourEur != null ? `~${(ourEur * FX.EUR).toFixed(0)}USD` : "?");
      console.log(
        `  ${p.sku ?? p.slug}: ours=${ours}USD  src=${result.priceRaw ?? "—"} (${result.status}${result.note ? "; " + result.note.slice(0, 40) : ""})`
      );
    }
  }

  await ctx.close();
  await browser.close();
  // prisma already disconnected above

  // Write outputs
  const esc = (s: any) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const header =
    "brand,sku,slug,title,ourPriceUsd,ourPriceEur,sourceUrl,sourcePriceRaw,sourcePriceNum,sourceCurrency,deltaPct,matchOk,status,note";
  const lines = rows.map((r) =>
    [
      r.brand,
      esc(r.sku),
      esc(r.slug),
      esc(r.title),
      r.ourPriceUsd ?? "",
      r.ourPriceEur ?? "",
      esc(r.sourceUrl),
      esc(r.sourcePriceRaw ?? ""),
      r.sourcePriceNum ?? "",
      r.sourceCurrency ?? "",
      r.deltaPct != null ? r.deltaPct.toFixed(1) : "",
      r.matchOk,
      r.status,
      esc(r.note),
    ].join(",")
  );
  await fs.writeFile(
    path.join(DATA, "price-comparison.csv"),
    [header, ...lines].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(DATA, "price-comparison.json"),
    JSON.stringify(rows, null, 2),
    "utf8"
  );

  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.status] = (tally[r.status] ?? 0) + 1;
  console.log("\n[price-comparison] tally:", tally);
  console.log(`  CSV:  ${path.join(DATA, "price-comparison.csv")}`);
})();
