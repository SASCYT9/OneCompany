/**
 * Scrape hero motorcycle photos from each Ilmberger model-collection page.
 * Each page has a banner image at the top showing the bike — perfect for
 * the bike-picker cards.
 *
 * Output: public/images/shop/ilmberger/bikes/{slug}.jpg (downloaded locally,
 * then upload-to-blob handles the rest).
 *
 * Run: node scripts/ilmberger/scrape-bike-heroes.mjs
 */
import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync, createWriteStream, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";

const BIKES = [
  // BMW (use newest gen collection URL per bike, that's where hero is freshest)
  {
    slug: "bmw-s1000rr",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_S1000RR_Strasse_ab2025",
  },
  {
    slug: "bmw-m1000rr",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_S1000RR_Strasse_ab2025",
  }, // M shares S page
  {
    slug: "bmw-s1000r",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_S1000R_ab2025",
  },
  {
    slug: "bmw-m1000r",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_M1000R_ab2025",
  },
  {
    slug: "bmw-s1000xr",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_S_1000_XR_ab_2024",
  },
  {
    slug: "bmw-m1000xr",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_BMW_M_1000_XR_ab_2024",
  },
  // Ducati (use latest gen)
  {
    slug: "ducati-panigale-v4",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Panigale_V4S_ab_2025_carbon",
  },
  {
    slug: "ducati-streetfighter-v4",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Streetfighter_V4S_ab_2025_carbon",
  },
  {
    slug: "ducati-diavel-v4",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Diavel_V4_2023",
  },
  {
    slug: "ducati-diavel-1260",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Diavel_ab_2019",
  },
  {
    slug: "ducati-xdiavel",
    url: "https://ilmberger-carbon.com/en/Carbon/Ilmberger_Carbon_Ducati_Diavel_ab_2019",
  }, // XDiavel shares Diavel page
];

const OUT_DIR = "public/images/shop/ilmberger/bikes";
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": "OneCompany-IlmbergerImporter/1.0 (b2b partner)" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function downloadImage(url, destPath) {
  if (existsSync(destPath) && statSync(destPath).size > 5000) {
    return { skipped: true, size: statSync(destPath).size };
  }
  const r = await fetch(url, {
    headers: { "User-Agent": "OneCompany-IlmbergerImporter/1.0" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const out = createWriteStream(destPath);
  await finished(Readable.fromWeb(r.body).pipe(out));
  return { skipped: false, size: statSync(destPath).size };
}

const mapping = {};
for (const bike of BIKES) {
  process.stdout.write(`  ${bike.slug} ... `);
  try {
    const html = await fetchText(bike.url);
    const $ = cheerio.load(html);
    // Find first /Ilmberger/CustomUpload/ img that's clearly a bike photo
    // (heuristic: file name contains the marque + model words, NOT product SKU)
    let heroUrl = null;
    $("img").each((_, el) => {
      if (heroUrl) return;
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (!src.includes("/Ilmberger/CustomUpload/")) return;
      if (/Logo|favicon|carbonBG|Headerfoto/i.test(src)) return;
      // Skip product close-ups (filename starts with product type like "CG_TAO_")
      if (/\/CG_[A-Z]{2,4}_\d+/.test(src)) return;
      heroUrl = src.startsWith("http")
        ? src
        : `https://ilmberger-carbon.com${src.replace(/^\/+/, "/")}`;
    });

    if (!heroUrl) {
      console.log("✗ no hero found");
      continue;
    }

    const destPath = path.join(OUT_DIR, `${bike.slug}.jpg`);
    const r = await downloadImage(heroUrl, destPath);
    mapping[bike.slug] = `/images/shop/ilmberger/bikes/${bike.slug}.jpg`;
    console.log(`✓ ${r.skipped ? "cached" : "downloaded"} (${r.size}b)`);
    await sleep(500);
  } catch (e) {
    console.log(`✗ ${e.message}`);
  }
}

writeFileSync("tmp/ilmberger-bike-heroes.json", JSON.stringify(mapping, null, 2));
console.log(`\n✅ ${Object.keys(mapping).length}/${BIKES.length} bike heroes saved`);
console.log(`   Mapping → tmp/ilmberger-bike-heroes.json`);
