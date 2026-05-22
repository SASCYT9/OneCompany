/**
 * Download Ilmberger product images locally + rewrite JSON paths.
 *
 * Reads --in <JSON> (default BMW S1000RR), fetches each imageUrl into
 * public/images/shop/ilmberger/products/{sku-slug}/{index}.jpg, then
 * rewrites imageUrls in the JSON to local /images/shop/... paths.
 *
 * Run:
 *   node scripts/ilmberger/download-images.mjs
 *   node scripts/ilmberger/download-images.mjs --in tmp/ilmberger-ducati-panigale-v4-2022.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { createWriteStream } from "fs";

const argv = process.argv.slice(2);
const inFlag = argv.indexOf("--in");
const JSON_PATH = inFlag >= 0 ? argv[inFlag + 1] : "tmp/ilmberger-bmw-s1000rr-strasse-ab2025.json";
const PUBLIC_DIR = "public/images/shop/ilmberger/products";

function skuToSlug(sku) {
  return sku.toLowerCase().replace(/[.\s]+/g, "-");
}

async function downloadOne(url, destPath) {
  if (existsSync(destPath) && statSync(destPath).size > 1000) {
    return { skipped: true, size: statSync(destPath).size };
  }
  // Normalize double-slash CDN paths
  const normalized = url.replace("//Ilmberger", "/Ilmberger");
  const res = await fetch(normalized, {
    headers: { "User-Agent": "OneCompany-IlmbergerImporter/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("No body");
  mkdirSync(path.dirname(destPath), { recursive: true });
  const out = createWriteStream(destPath);
  await finished(Readable.fromWeb(res.body).pipe(out));
  return { skipped: false, size: statSync(destPath).size };
}

async function main() {
  const products = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
  console.log(`📥 Downloading images for ${products.length} products\n`);

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const p of products) {
    const slug = skuToSlug(p.sku);
    const localPaths = [];

    for (let i = 0; i < p.imageUrls.length; i++) {
      const url = p.imageUrls[i];
      // Use original file extension
      const ext =
        path.extname(new URL(url.replace("//Ilmberger", "/Ilmberger")).pathname) || ".jpg";
      const filename = `${i + 1}${ext.toLowerCase()}`;
      const destAbsolute = path.join(PUBLIC_DIR, slug, filename);
      const publicPath = `/images/shop/ilmberger/products/${slug}/${filename}`;

      try {
        const r = await downloadOne(url, destAbsolute);
        if (r.skipped) {
          console.log(`  ⏭ ${p.sku} #${i + 1} (cached ${r.size}b)`);
          totalSkipped++;
        } else {
          console.log(`  ✓ ${p.sku} #${i + 1} → ${publicPath} (${r.size}b)`);
          totalDownloaded++;
        }
        localPaths.push(publicPath);
      } catch (e) {
        console.log(`  ✗ ${p.sku} #${i + 1} FAILED: ${e.message}`);
        totalFailed++;
      }
    }

    // Replace URLs with local paths (keep original for reference)
    p.imageUrlsOriginal = p.imageUrls;
    p.imageUrls = localPaths;
  }

  writeFileSync(JSON_PATH, JSON.stringify(products, null, 2));
  console.log(
    `\n✅ Downloaded ${totalDownloaded}, skipped ${totalSkipped}, failed ${totalFailed}.`
  );
  console.log(`   JSON updated — imageUrls now point to /images/shop/... locally.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
