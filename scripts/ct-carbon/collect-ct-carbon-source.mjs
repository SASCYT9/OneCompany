#!/usr/bin/env node
/**
 * Collects the CT Carbon catalogue from the public ctcarbon.co store (Shopify, GBP):
 * titles, descriptions (with the kit contents), product type, tags, photos, variants
 * and their regular ex-VAT prices. CT Carbon's own site shows prices with 20% UK VAT.
 *
 * Left out: clothing, gift cards, fitting services and products with no variant in
 * stock on ctcarbon.co (listed under `excluded` with the reason).
 *
 * Usage: node scripts/ct-carbon/collect-ct-carbon-source.mjs [--out=data/ct-carbon/source.json]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

const STORE = "https://www.ctcarbon.co";
const FEED = `${STORE}/products.json`;
const USER_AGENT = "Mozilla/5.0 (compatible; OneCompanyCatalog/1.0; +https://onecompany.global)";

const outPath = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ?? "data/ct-carbon/source.json"
);

const clean = (value) =>
  String(value ?? "")
    .replace(/ /g, " ")
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

/** Description text split into paragraphs and list items; the [additional] block is the fitment note. */
function parseBody(html) {
  const raw = String(html ?? "");
  const additional = raw.match(/\[additional\]([\s\S]*?)\[\/additional\]/i)?.[1] ?? "";
  // One car per element: keep them apart ("…B9 A5; 2016-2019 Audi B9 S5…").
  const fitmentHtml = additional.replace(/<br\s*\/?>|<\/(?:p|li|div|span)>/gi, "; ");
  const fitmentNote =
    clean(load(`<body>${fitmentHtml}</body>`)("body").text())
      .replace(/(?:\s*;\s*)+/g, "; ")
      .replace(/^;\s*|;\s*$/g, "") || null;
  const $ = load(`<body>${raw.replace(/\[additional\][\s\S]*?\[\/additional\]/gi, " ")}</body>`);
  $("br").replaceWith("\n");
  const blocks = [];
  $("p, li, h1, h2, h3, h4, h5, h6, div").each((_, node) => {
    if ($(node).children("p, li, div, ul, ol").length) return;
    const text = $(node).text();
    for (const line of text.split("\n")) {
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
  return { fitmentNote, paragraphs: Array.from(new Set(blocks)).slice(0, 40) };
}

function exclusionReason(product) {
  const title = clean(product.title);
  if (/^clothing$/i.test(product.product_type)) return "clothing";
  if (/^service$/i.test(product.product_type) || /\bfitting\b/i.test(title)) return "service";
  if (
    /gift card/i.test(title) ||
    product.options.some((option) => /gift card/i.test(option.name))
  ) {
    return "gift card";
  }
  if (!product.variants.some((variant) => Number(variant.price) > 0)) return "no price";
  if (!product.variants.some((variant) => variant.available)) return "not available on ctcarbon.co";
  if (!product.images.length) return "no photos";
  return null;
}

async function main() {
  const raw = [];
  for (let page = 1; page <= 40; page += 1) {
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
    const optionNames = product.options
      .map((option) => clean(option.name))
      .filter((name) => name && name !== "Title");
    products.push({
      id: product.id,
      handle: product.handle,
      url: `${STORE}/products/${product.handle}`,
      title: clean(product.title),
      vendor: clean(product.vendor),
      productType: clean(product.product_type),
      tags: product.tags.map(clean).filter(Boolean),
      optionNames,
      fitmentNote: body.fitmentNote,
      bodyParagraphs: body.paragraphs,
      images: Array.from(new Set(product.images.map((image) => stripQuery(image.src)))),
      variants: product.variants
        .filter((variant) => variant.available && Number(variant.price) > 0)
        .map((variant) => {
          const price = Number(variant.price);
          const compareAt = Number(variant.compare_at_price) || 0;
          return {
            id: variant.id,
            sku: clean(variant.sku) || null,
            title: clean(variant.title),
            options: [variant.option1, variant.option2, variant.option3]
              .map(clean)
              .filter((value) => value && value !== "Default Title"),
            // The regular price: during a sale Shopify keeps it in compare_at_price.
            priceExVatGbp: Math.max(price, compareAt),
            salePriceExVatGbp: compareAt > price ? price : null,
            grams: Number(variant.grams) || 0,
            image: variant.featured_image?.src ? stripQuery(variant.featured_image.src) : null,
          };
        }),
      updatedAt: product.updated_at ?? null,
    });
  }

  products.sort((a, b) => a.handle.localeCompare(b.handle));
  await writeFile(
    outPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: FEED,
        generatedAt: new Date().toISOString(),
        products,
        excluded,
      },
      null,
      1
    )}\n`
  );
  const byReason = excluded.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `saved ${products.length} products (${products.reduce((sum, product) => sum + product.variants.length, 0)} variants) to ${outPath}`
  );
  console.log(`excluded ${excluded.length}: ${JSON.stringify(byReason)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
