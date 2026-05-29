/**
 * Scrape bike thumbnail URLs from Ilmberger BMW + Ducati index pages.
 * Outputs tmp/ilmberger-bike-thumbs.json with { modelSlug, label, url } per bike.
 *
 * Run: node scripts/ilmberger/scrape-bike-thumbs.mjs
 */
import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "fs";

const INDEX_URLS = [
  "https://ilmberger-carbon.com/en/Carbon/Carbon_Motorrad/BMW",
  "https://ilmberger-carbon.com/en/Carbon/Carbon_Motorrad/Ilmberger_Carbon_Ducati",
];
const OUT = "tmp/ilmberger-bike-thumbs.json";

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "OneCompany-IlmbergerImporter/1.0 (b2b partner; ivan.pob@onecompany.global)",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const bikes = [];

for (const url of INDEX_URLS) {
  console.log(`📥 ${url}`);
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  // Bikes are usually rendered as <a> wrapping <img> + label inside category grids.
  // We capture every <a href="*/Ilmberger_Carbon_*"> with an inner img under /Ilmberger/CustomUpload/.
  $("a").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (!/\/Ilmberger_Carbon_(BMW|Ducati)[^/]+$/.test(href)) return;
    const $img = $(a).find("img").first();
    if (!$img.length) return;
    const src = $img.attr("src") || $img.attr("data-src") || "";
    if (!src.includes("/Ilmberger/CustomUpload/")) return;

    const absoluteSrc = src.startsWith("http")
      ? src
      : `https://ilmberger-carbon.com${src.replace(/^\/+/, "/")}`;
    // Label = visible text near the link
    const label = $(a).find("h2, h3, span, p").first().text().trim() || $(a).text().trim();
    const slug = href.split("/").pop();

    bikes.push({ slug, label: label.slice(0, 80), thumbUrl: absoluteSrc, sourceHref: href });
  });
}

// Dedupe by slug
const unique = new Map();
for (const b of bikes) {
  if (!unique.has(b.slug)) unique.set(b.slug, b);
}
const out = [...unique.values()];

mkdirSync("tmp", { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\n✅ ${out.length} unique bikes → ${OUT}`);
out.slice(0, 30).forEach((b) => console.log(`  ${b.slug}  →  ${b.thumbUrl.substring(0, 90)}…`));
