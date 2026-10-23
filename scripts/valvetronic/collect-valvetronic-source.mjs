#!/usr/bin/env node
/**
 * Collects the Valvetronic Designs exhaust catalogue from the public valvetronic.com
 * store (Shopify, USD): titles, descriptions, photos, YouTube videos, variants with
 * their regular price (never the sale price), shipping weight and the brand's SKU.
 *
 * Left out: clothing, merch, gift cards, deposits, dealer displays, chassis braces
 * (not exhaust parts) and variants that are not orderable on valvetronic.com
 * (listed under `excluded` with the reason).
 *
 * Usage: node scripts/valvetronic/collect-valvetronic-source.mjs [--out=data/valvetronic/source.json]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

const STORE = "https://valvetronic.com";
const FEED = `${STORE}/products.json`;
const USER_AGENT = "Mozilla/5.0 (compatible; OneCompanyCatalog/1.0; +https://onecompany.global)";

const outPath = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ?? "data/valvetronic/source.json"
);

const clean = (value) =>
  String(value ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[￼�​]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const stripQuery = (src) => String(src).split("?")[0];

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`${url} returned ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
  }
  throw new Error(`${url} kept failing`);
}

/** Description text split into paragraphs and list items, plus the YouTube videos it embeds. */
function parseBody(html) {
  const raw = String(html ?? "");
  const videos = [];
  for (const match of raw.matchAll(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/g
  )) {
    if (!videos.includes(match[1])) videos.push(match[1]);
  }
  const $ = load(`<body>${raw}</body>`);
  $("iframe, script, style, img, video").remove();
  $("br").replaceWith("\n");
  const blocks = [];
  $("p, li, h1, h2, h3, h4, h5, h6, div, td").each((_, node) => {
    if ($(node).children("p, li, div, ul, ol, table").length) return;
    for (const line of $(node).text().split("\n")) {
      const value = clean(line.replace(/^[-•]\s*/, ""));
      if (value) blocks.push(value);
    }
  });
  if (!blocks.length) {
    for (const line of $("body").text().split("\n")) {
      const value = clean(line);
      if (value) blocks.push(value);
    }
  }
  return { videos, paragraphs: Array.from(new Set(blocks)).slice(0, 60) };
}

function exclusionReason(product) {
  const title = clean(product.title);
  const type = clean(product.product_type);
  if (/^(?:clothing|sticker|display|decor)$/i.test(type)) return "merch";
  if (
    /\b(?:hoodie|t-shirt|shirt|hat|beanie|flag|sticker|key tag|license plate frame)\b/i.test(title)
  ) {
    return "merch";
  }
  if (/gift card/i.test(title)) return "gift card";
  if (/\bdeposit\b/i.test(title)) return "deposit";
  if (/\bwholesale\b/i.test(title)) return "dealer material";
  // Strut / chassis braces are suspension parts, not exhaust.
  if (/chassis brace/i.test(title)) return "not an exhaust part";
  if (!product.variants.some((variant) => Number(variant.price) > 0)) return "no price";
  if (!product.variants.some((variant) => variant.available)) {
    return "not orderable on valvetronic.com";
  }
  if (!product.images.length) return "no photos";
  return null;
}

/** One name per kind of choice, so the product page can translate it. */
const OPTION_NAMES = [
  [/tip|outlet/i, "Tips"],
  [/material|finish|colou?r/i, "Material"],
  [/front (?:pipe|section)|down ?pipe|header|mid ?pipe|free flow pipes/i, "Front Pipes"],
  [/engine/i, "Engine Type"],
  [/quantity|\bqty\b/i, "Quantity"],
  [/valve/i, "Valves"],
  [/size|diameter|inlet/i, "Size"],
  [/applica|vehicle|model|fitment|generation|version/i, "Application"],
  [/style|design/i, "Design"],
  [/config|system|package|option|type|item/i, "Configuration"],
];

/** Name for a second axis that would get the same name as the first. */
const SECOND_NAMES = { Configuration: "System", Material: "Finish", Design: "Configuration" };

function normalizeOptionName(name) {
  const value = clean(name);
  for (const [pattern, normalized] of OPTION_NAMES) if (pattern.test(value)) return normalized;
  return value;
}

/**
 * Shopify feeds carry three option values; a product with a fourth axis (Audi R8 material)
 * only has it in the variant title ("True F1 / R8 V10 … / Catback / 6AL-4V Titanium").
 */
function variantOptionValues(variant, axes) {
  const values = [variant.option1, variant.option2, variant.option3];
  if (axes > 3) {
    const parts = String(variant.title ?? "").split(" / ");
    if (parts.length === axes) return parts;
  }
  return values.slice(0, axes);
}

/** Words that stay in capitals when an ALL-CAPS value is turned into title case. */
const KEEP_UPPER = new Set([
  "OEM",
  "OE",
  "OPF",
  "GPF",
  "SS",
  "HFD",
  "AMG",
  "BMW",
  "F1",
  "XL",
  "2XL",
  "S",
  "M",
  "L",
  "V8",
  "V10",
  "V12",
  "B58",
  "T304",
  "MM",
]);

const SMALL_WORDS = new Set(["a", "an", "and", "for", "of", "or", "to", "with", "without"]);

/** One spelling per word: "SPORT CATBACK system ONLY" → "Sport Catback System Only". */
function titleCaseWords(value) {
  return value
    .split(/(\s+|[()/+&,.-])/)
    .map((word, index) => {
      if (/^mm$/i.test(word)) return "mm";
      if (/^etc$/i.test(word)) return "etc.";
      if (!/[A-Za-z]/.test(word) || KEEP_UPPER.has(word)) return word;
      // Short capitals are model codes (SVJ, STO, EVO, GT); "NO TIPS" is a word.
      if (
        /^[A-Z]{2,3}$/.test(word) &&
        !["NO", "ALL", "AND", "FOR", "THE", "ONE", "RAW", "GEN"].includes(word)
      ) {
        return word;
      }
      if (/\d/.test(word)) return word.replace(/X(?=\d)/, "x").replace(/MM$/i, "mm");
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      // Mixed-case words are deliberate (Blackbear™, Cerakote®, i4, 6Al-4V).
      if (word !== lower && word !== word.toUpperCase()) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function normalizeOptionValue(value) {
  return titleCaseWords(
    clean(value)
      .replace(/^'+/, "")
      .replace(/^\+\s*/, "+ ")
      .replace(/[“”″]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\bPnuematic\b/gi, "Pneumatic")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .replace(/\(([^()]*)$/, "($1)")
      // Tip outlets: "3.5 Outlet", "3.5 inch outlet", "4 Inch Outlet" → 3.5" / 4.0" Outlet.
      .replace(
        /\b(\d(?:\.\d+)?)\s*(?:"|inch\b|in\b)?\s*outlet\b/gi,
        (_, size) => `${size.includes(".") ? size : `${size}.0`}" Outlet`
      )
      .replace(/\bcarbon fiber\b/gi, "Carbon Fiber")
  );
}

async function main() {
  const raw = [];
  for (let page = 1; page <= 10; page += 1) {
    const { products } = await fetchJson(`${FEED}?limit=250&page=${page}`);
    if (!products.length) break;
    raw.push(...products);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const products = [];
  const excluded = [];
  for (const product of raw) {
    const reason = exclusionReason(product);
    if (reason) {
      excluded.push({ handle: product.handle, title: clean(product.title), reason });
      continue;
    }
    const body = parseBody(product.body_html);
    const declared = product.options
      .map((option) => clean(option.name))
      .filter((name) => name && name !== "Title");
    const optionNames = [];
    for (const name of declared.map(normalizeOptionName)) {
      // Two axes that normalise to the same name keep apart ("Configuration" + "System").
      optionNames.push(optionNames.includes(name) ? (SECOND_NAMES[name] ?? `${name} 2`) : name);
    }
    const variants = product.variants
      .filter((variant) => variant.available && Number(variant.price) > 0)
      .map((variant) => {
        const price = Number(variant.price);
        const compareAt = Number(variant.compare_at_price) || 0;
        return {
          id: variant.id,
          sku: clean(variant.sku) || null,
          title: clean(variant.title),
          options: variantOptionValues(variant, declared.length)
            .map((value) => (value == null ? "" : normalizeOptionValue(value)))
            .filter((value) => value && value !== "Default Title"),
          // The regular price: during a sale Shopify keeps it in compare_at_price.
          priceUsd: Math.max(price, compareAt),
          salePriceUsd: compareAt > price ? price : null,
          grams: Number(variant.grams) || 0,
          image: variant.featured_image?.src ? stripQuery(variant.featured_image.src) : null,
        };
      });
    const dropped = product.variants.length - variants.length;
    if (dropped) {
      excluded.push({
        handle: product.handle,
        title: clean(product.title),
        reason: `${dropped} of ${product.variants.length} variants not orderable`,
      });
    }
    products.push({
      id: product.id,
      handle: product.handle,
      url: `${STORE}/products/${product.handle}`,
      title: clean(product.title),
      vendor: clean(product.vendor),
      productType: clean(product.product_type),
      tags: product.tags.map(clean).filter(Boolean),
      optionNames,
      bodyParagraphs: body.paragraphs,
      videos: body.videos,
      images: Array.from(new Set(product.images.map((image) => stripQuery(image.src)))),
      variants,
      updatedAt: product.updated_at ?? null,
    });
  }

  // Combined listings repeat the variants of two or more separate listings (all E9X M3
  // systems on one page): keep the separate products, which have cleaner choices.
  const skusOf = (product) => product.variants.map((variant) => variant.sku).filter(Boolean);
  const combined = products.filter((product) => {
    const skus = skusOf(product);
    if (!skus.length) return false;
    const others = products.filter((other) => other !== product);
    const coveredByUnion = skus.every((sku) => others.some((other) => skusOf(other).includes(sku)));
    const coveredByOne = others.some((other) => skus.every((sku) => skusOf(other).includes(sku)));
    return coveredByUnion && !coveredByOne;
  });
  for (const product of combined) {
    products.splice(products.indexOf(product), 1);
    excluded.push({
      handle: product.handle,
      title: product.title,
      reason: "combined listing of other products",
    });
  }

  const MATERIAL_VALUE = /steel|titanium|carbon|stainless|anodized|cerakote|\bT304\b/i;
  for (const product of products) {
    // "Item Configuration: Brushed T304 Stainless Steel / Grade 5 Titanium" is a material choice.
    product.optionNames.forEach((name, axis) => {
      if (product.optionNames.includes("Material")) return;
      if (!["Configuration", "System", "Design"].includes(name)) return;
      const values = product.variants.map((variant) => variant.options[axis]);
      if (values.every((value) => MATERIAL_VALUE.test(value ?? ""))) {
        product.optionNames[axis] = "Material";
      }
    });
    if (!product.optionNames.includes("Configuration")) {
      const system = product.optionNames.indexOf("System");
      if (system >= 0) product.optionNames[system] = "Configuration";
    }
    // The shop stores three choices per variant: a fourth axis that another axis already
    // decides ("Exhaust Style" follows "System Configuration") is dropped.
    while (product.optionNames.length > 3) {
      const axes = product.optionNames.length;
      const implied = product.optionNames.findIndex((_, axis) =>
        Array.from({ length: axes }, (_, other) => other).some((other) => {
          if (other === axis) return false;
          const seen = new Map();
          return product.variants.every((variant) => {
            const key = variant.options[other];
            if (seen.has(key) && seen.get(key) !== variant.options[axis]) return false;
            seen.set(key, variant.options[axis]);
            return true;
          });
        })
      );
      if (implied < 0) throw new Error(`${product.handle}: ${axes} independent choices`);
      product.optionNames.splice(implied, 1);
      for (const variant of product.variants) variant.options.splice(implied, 1);
    }
  }

  products.sort((a, b) => a.handle.localeCompare(b.handle));
  await writeFile(
    outPath,
    `${JSON.stringify(
      { schemaVersion: 1, source: FEED, generatedAt: new Date().toISOString(), products, excluded },
      null,
      1
    )}\n`
  );
  const byReason = excluded.reduce((acc, item) => {
    const key = /variants not orderable/.test(item.reason)
      ? "some variants not orderable"
      : item.reason;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `saved ${products.length} products (${products.reduce((sum, product) => sum + product.variants.length, 0)} variants) to ${outPath}`
  );
  console.log(`excluded: ${JSON.stringify(byReason)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
