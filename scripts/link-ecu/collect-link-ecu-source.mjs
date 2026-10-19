#!/usr/bin/env node
/**
 * Collects the Link ECU catalogue from the public linkecu.com store (Shopify):
 * EU RRP in EUR (`products.json?currency=EUR`, equal to the EU dealer portal RRP),
 * texts, the specification accordions of each product page, photos and shipping grams.
 *
 * Scope (Ігор, 17.10.2026): Wire-In and Plug-In ECUs (incl. LS engine-harness bundles)
 * and, from accessories, the Razor PDM only.
 *
 * Usage: node scripts/link-ecu/collect-link-ecu-source.mjs [--out=data/link-ecu/source.json]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { load } from "cheerio";

const FEED = "https://linkecu.com/products.json?limit=250&currency=EUR";
const USER_AGENT = "Mozilla/5.0 (compatible; OneCompanyCatalog/1.0; +https://onecompany.global)";
/** Display-only or not in the EU price list (their EUR price is auto-converted). */
const EXCLUDED_SKUS = new Set(["207-1000", "207-4000", "350-4000"]);

const outPath = path.resolve(
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ?? "data/link-ecu/source.json"
);

const clean = (value) =>
  String(value ?? "")
    .replace(/ /g, " ")
    .replace(/�/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function kindOf(product) {
  const title = product.title;
  if (product.product_type === "Power Distribution") return "pdm";
  if (/Bundle/.test(title)) return "ls-bundle";
  if (product.product_type === "Wire-In ECU" && !/Plug-In/.test(title)) return "wire-in";
  return "plug-in";
}

function isTarget(product) {
  const title = product.title;
  if (/Keypad|Test Bundle/.test(title)) return false;
  return (
    ["Plug-In ECU", "Wire-In ECU", "Power Distribution"].includes(product.product_type) ||
    /Plug-In ECU|Bundle|Link - /.test(title)
  );
}

/** The product-details accordions: headings, paragraphs, bullet items and spec rows. */
function parseSpecSections(html) {
  const $ = load(html);
  const sections = [];
  $(".specifications-section details").each((_, details) => {
    const title = clean($(details).find("summary .heading").first().text());
    if (!title) return;
    const content = $(details).find(".details__content").first();
    const rows = [];
    content.find("tr").each((__, row) => {
      const heading = clean($(row).find("h4").first().text());
      if (!heading) return;
      const valueCell = $(row).find("td").last();
      const values = [];
      valueCell.find("p, li").each((___, node) => {
        const text = clean($(node).text());
        if (text) values.push(text);
      });
      if (!values.length) {
        const text = clean(valueCell.text());
        if (text) values.push(text);
      }
      rows.push({ heading, values });
    });
    const paragraphs = [];
    const items = [];
    content.find("p").each((__, node) => {
      if ($(node).closest("table").length) return;
      const text = clean($(node).text());
      if (text) paragraphs.push(text);
    });
    content.find("li").each((__, node) => {
      if ($(node).closest("table").length) return;
      const text = clean($(node).text());
      if (text) items.push(text);
    });
    sections.push({ title, rows, paragraphs, items });
  });
  return sections;
}

async function main() {
  const { products } = JSON.parse(await fetchText(FEED));
  const out = [];
  for (const product of products) {
    if (!isTarget(product)) continue;
    const variant = product.variants[0];
    const sku = clean(variant?.sku);
    if (!sku || EXCLUDED_SKUS.has(sku) || /not-for-sale/.test(product.handle)) continue;
    const url = `https://linkecu.com/products/${product.handle}`;
    const page = await fetchText(url);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const body = load(`<body>${product.body_html ?? ""}</body>`);
    const bodyParagraphs = [];
    body("p").each((_, node) => {
      if (body(node).closest("table").length) return;
      const text = clean(body(node).text());
      if (text) bodyParagraphs.push(text);
    });
    out.push({
      sku,
      handle: product.handle,
      url,
      titleSource: clean(product.title),
      productType: product.product_type ?? "",
      kind: kindOf(product),
      // RRP is the regular price: during a sale Shopify keeps it in compare_at_price.
      rrpEur: Math.max(Number(variant.price), Number(variant.compare_at_price) || 0),
      grams: Number(variant.grams) || 0,
      images: [...new Set(product.images.map((image) => String(image.src).split("?")[0]))],
      bodyParagraphs: bodyParagraphs.slice(0, 12),
      sections: parseSpecSections(page),
      updatedAt: product.updated_at ?? null,
    });
    console.log(`${sku.padEnd(10)} €${variant.price.padStart(8)}  ${clean(product.title)}`);
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.sku.localeCompare(b.sku));
  await writeFile(
    outPath,
    `${JSON.stringify({ schemaVersion: 1, source: FEED, generatedAt: new Date().toISOString(), products: out }, null, 1)}\n`
  );
  console.log(`saved ${out.length} products to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
