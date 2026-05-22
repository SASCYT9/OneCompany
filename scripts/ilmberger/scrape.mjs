/**
 * Ilmberger Carbon scraper — generic, works for any model collection URL.
 *
 * Reads category page → finds product detail URLs (auto-derives the URL
 * pattern from the category slug) → fetches each → parses
 *   { sku, title, price, descriptionHtml, imageUrls, category, fitment }
 * → writes JSON to --out (auto-derived from --url slug if omitted).
 *
 * Run:
 *   # BMW S1000RR (default, backward-compat):
 *   node scripts/ilmberger/scrape.mjs
 *
 *   # Ducati Panigale V4 ab_2022:
 *   node scripts/ilmberger/scrape.mjs \
 *     --url "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Panigale_V4S_ab_2022" \
 *     --out tmp/ilmberger-ducati-panigale-v4-2022.json
 *
 *   # Limit + filter:
 *   node scripts/ilmberger/scrape.mjs --limit 1 --only Tankabdeckung
 */
import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const DEFAULT_CATEGORY_URL =
  "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_S1000RR_Strasse_ab2025";
const DELAY_MS = 600;

// CLI flags
const argv = process.argv.slice(2);
const urlFlag = argv.indexOf("--url");
const CATEGORY_URL = urlFlag >= 0 ? argv[urlFlag + 1] : DEFAULT_CATEGORY_URL;
const outFlag = argv.indexOf("--out");
const limitFlag = argv.indexOf("--limit");
const LIMIT = limitFlag >= 0 ? parseInt(argv[limitFlag + 1], 10) : null;
const onlyFlag = argv.indexOf("--only");
const ONLY = onlyFlag >= 0 ? argv[onlyFlag + 1].toLowerCase() : null;

// Derive product-URL substring from category URL — Ilmberger keeps detail
// pages directly under the category slug. e.g. category
//   /en/Carbon/Ilmberger_Carbon_Ducati_Panigale_V4S_ab_2022
// has details at
//   /en/Carbon/Carbon_Motorrad/Ducati/Ilmberger_Carbon_Ducati_Panigale_V4S_ab_2022/{name}
// The shared trailing slug is the part after the last underscore-prefixed
// "Ilmberger_Carbon_" segment. Treat it as the unique key per collection.
const collectionSlug = CATEGORY_URL.split("/").pop();
const PRODUCT_URL_HINT = `/${collectionSlug}/`;

// Auto-derive OUTPUT from collection slug if --out not provided.
const OUTPUT =
  outFlag >= 0
    ? argv[outFlag + 1]
    : `tmp/ilmberger-${collectionSlug
        .toLowerCase()
        .replace(/^ilmberger_carbon_/, "")
        .replace(/_/g, "-")}.json`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "OneCompany-IlmbergerImporter/1.0 (b2b partner; contact: ivan.pob@onecompany.global)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/**
 * From a product detail HTML extract structured fields.
 * Returns null if essential fields (title, sku, price) are missing.
 */
function parseProduct(html, url) {
  const $ = cheerio.load(html);

  // Title — first <h1> on the page
  const title = $("h1").first().text().trim();
  if (!title) {
    console.warn(`  ⚠ no <h1> in ${url}`);
    return null;
  }

  // SKU — Ilmberger uses different formats per marque:
  //   BMW:    CG.TAO.011.S119S   (4 parts, "CG." prefix)
  //   Ducati: RIA.032.DPV4G.K    (4 parts, no prefix, ends with 1-letter variant)
  // Generic pattern: 4 dot-separated alphanumeric segments. We prefer the SKU
  // shown right after "Article Number:" / "Artikelnummer:" / "Art.-Nr.:" if
  // available (more reliable than scanning the whole document).
  const labelMatch = html.match(
    /(?:Article\s*Number|Artikelnummer|Art\.?[- ]?Nr\.?)[:\s]*([A-Z]{2,5}\.[A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)/i
  );
  const skuMatch = labelMatch ?? html.match(/\b[A-Z]{2,5}\.[A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+\b/);
  if (!skuMatch) {
    console.warn(`  ⚠ no SKU in ${url}`);
    return null;
  }
  // labelMatch returns capture group at [1]; generic regex returns full match at [0].
  const sku = labelMatch ? labelMatch[1] : skuMatch[0];

  // Price — Vue.js renders inside <span>NNN.NN</span><span>€</span>.
  // Scan all numeric span texts near a € sign.
  let price = null;
  $("span").each((_, el) => {
    const t = $(el).text().trim();
    if (/^\d{1,4}[.,]\d{2}$/.test(t)) {
      // Check the next sibling span has €
      const next = $(el).next("span").text().trim();
      const parentText = $(el).parent().text();
      if (next === "€" || parentText.includes("€")) {
        const num = parseFloat(t.replace(",", "."));
        if (!price || num < price) price = num; // pick smallest (base price, not include VAT line)
      }
    }
  });
  if (!price) {
    console.warn(`  ⚠ no price in ${url}`);
    return null;
  }

  // Description — `.product-description` container (with h3/ul/li/p inside)
  const descBlock = $(".product-description").first();
  let descriptionHtmlEn = "";
  if (descBlock.length) {
    // Strip inline links to ilmberger-carbon.com — they'd 404 on us
    descBlock.find("a").each((_, a) => {
      const href = $(a).attr("href") || "";
      if (href.includes("ilmberger-carbon.com")) {
        $(a).replaceWith($(a).text());
      }
    });
    descriptionHtmlEn = descBlock.html()?.trim() ?? "";
  }

  // Images — Ilmberger CDN paths, but FILTER OUT logos/icons/UI assets.
  // Product photos come in two naming patterns:
  //   1. Model-name prefixed: BMW_S1000RR_2019_Ilmberger_carbon_19_1.jpg
  //   2. SKU-prefixed (newer 2025 products): CG_VEO_001_S125S_1.jpg
  // Exclude logos, favicons, UI background assets.
  const imageUrls = [];
  $("img").each((_, img) => {
    const src = $(img).attr("src") || $(img).attr("data-src") || "";
    if (!src.includes("/Ilmberger/CustomUpload/")) return;
    if (!/\.(jpg|jpeg|png|webp|avif)$/i.test(src)) return;
    // Exclude UI assets
    if (/\/(?:Webportal|WebPortal)\//.test(src)) return;
    if (/Ilmberger-Logo|favicon|carbonBG|Headerfoto/i.test(src)) return;
    // OK — looks like a real product photo
    const absolute = src.startsWith("http")
      ? src
      : `https://ilmberger-carbon.com${src.replace(/^\/+/, "/")}`;
    if (!imageUrls.includes(absolute)) imageUrls.push(absolute);
  });

  // Categorize — based on SKU prefix or title keywords
  const titleLower = title.toLowerCase();
  let category = "other";
  if (/tank cover|tank|tao\./i.test(title + " " + sku)) category = "tank-covers";
  else if (/fender|kotfl|kvo\./i.test(title + " " + sku)) category = "fenders";
  else if (/hugger|kho\./i.test(title + " " + sku)) category = "wheel-covers";
  else if (/swing[- ]?arm|scl\.|scr\.|chain|belt/i.test(title + " " + sku))
    category = "frame-protection";
  else if (/frame cover|rotor|ral\.|rar\.|frm\.|zrd\./i.test(title + " " + sku))
    category = "frame-protection";
  else if (/sprocket|rio\./i.test(title + " " + sku)) category = "frame-protection";
  else if (/clutch|alternator|kda\.|lmd\.|pua\.|water pump/i.test(title + " " + sku))
    category = "cockpit";
  else if (/heel|fsl\.|fsr\./i.test(title + " " + sku)) category = "frame-protection";
  else if (/instrument|cockpit|iao\.|dash/i.test(title + " " + sku)) category = "cockpit";
  else if (/belly pan|veu\.|verkleidung/i.test(title + " " + sku)) category = "fairings";
  else if (/side panel|sdl\.|sdr\.|fairing/i.test(title + " " + sku)) category = "fairings";
  else if (/badge|number|nho\.|vel\.|ver\.|eka\.|ahs\.|silencer/i.test(title + " " + sku))
    category = "cockpit";

  // Fitment — extract bike model(s) from title
  // Title example: "Upper Tank Cover BMW S 1000 RR from MY 2019 / M 1000 RR / S 1000 R / M 1000 R"
  const fitmentMatch = title.match(/(BMW|Ducati|Aprilia|Yamaha|Honda|Kawasaki)\b.+/i);
  const fitment = fitmentMatch ? fitmentMatch[0].replace(/\s+/g, " ").trim() : "";

  return {
    sku,
    url,
    titleEn: title,
    priceEur: price,
    descriptionHtmlEn,
    imageUrls,
    category,
    fitment,
  };
}

async function main() {
  console.log(`📥 Fetching category page: ${CATEGORY_URL}`);
  const catHtml = await fetchText(CATEGORY_URL);
  const $ = cheerio.load(catHtml);

  // Collect product detail URLs — any <a href> whose path contains
  // PRODUCT_URL_HINT (the collection slug surrounded by slashes). This
  // catches the same-section detail pages regardless of marque (BMW/Ducati/etc).
  const productUrls = new Set();
  $("a").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (
      href.includes(PRODUCT_URL_HINT) &&
      !href.endsWith(collectionSlug) // skip the back-link to category itself
    ) {
      const absolute = href.startsWith("http")
        ? href
        : `https://ilmberger-carbon.com${href.replace(/^\/+/, "/")}`;
      productUrls.add(absolute);
    }
  });

  let urls = Array.from(productUrls);
  if (ONLY) {
    urls = urls.filter((u) => u.toLowerCase().includes(ONLY));
    console.log(`🎯 Filtered by --only "${ONLY}": ${urls.length} URL(s)`);
  }
  if (LIMIT) {
    urls = urls.slice(0, LIMIT);
    console.log(`🎯 Limited to ${LIMIT}`);
  }
  console.log(`📋 Will fetch ${urls.length} product page(s)\n`);

  const products = [];
  let i = 0;
  for (const url of urls) {
    i++;
    process.stdout.write(`  [${i}/${urls.length}] ${url.split("/").pop()} ... `);
    try {
      const html = await fetchText(url);
      const parsed = parseProduct(html, url);
      if (parsed) {
        products.push(parsed);
        console.log(`✓ ${parsed.sku} ${parsed.priceEur}€ (${parsed.imageUrls.length} img)`);
      } else {
        console.log(`✗ skipped`);
      }
    } catch (e) {
      console.log(`✗ ERROR: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  // Write output
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(products, null, 2));
  console.log(`\n✅ Saved ${products.length} products → ${OUTPUT}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
