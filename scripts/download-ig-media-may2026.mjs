/**
 * Download IG media via fastdl.app for the May 2026 sync batch.
 * Captions are already known (scripts/ig-captions-may2026.json).
 * Files saved as {shortcode}-v5-{n}.{ext} with magic-bytes type detection.
 */
import { chromium } from "playwright";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";

const SHORTCODES = [
  "DYUTmKAMy6s", // STOPFLEX BMW 7 G12
  "DYSD4QNDCvi", // IPE Porsche 992 GT3
  "DX9N9mFDPGs", // KW HAS BMW M5 F90
  "DXyrwK6sV1b", // RIZOMA moto
  "DXqyWeeDMzC", // NITRON BMW M2
];

const IMAGES_DIR = path.resolve("public/images/blog");
const VIDEOS_DIR = path.resolve("public/videos/blog");
const OUT_FILE = path.resolve("scripts/ig-media-may2026.json");
const VERSION = "v5";

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    proto
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {}
        reject(err);
      });
  });
}

function detectFileType(filePath) {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    if (buffer.toString("utf8", 4, 8) === "ftyp") return "video";
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3)
      return "video";
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
      return "image";
    if (buffer.toString("utf8", 0, 4) === "RIFF" && buffer.toString("utf8", 8, 12) === "WEBP")
      return "image";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function processOne(page, shortcode) {
  console.log(`\n${"=".repeat(60)}\n${shortcode}\n${"=".repeat(60)}`);

  // 1. Submit URL on fastdl.app
  try {
    await page.goto("https://fastdl.app/en", { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (e) {
    console.error(`  fastdl.app load failed: ${e.message}`);
    return { shortcode, error: "fastdl-load" };
  }
  await page.waitForTimeout(800);

  try {
    await page.fill("#search-form-input", `https://www.instagram.com/p/${shortcode}/`);
    await page.click(".search-form__button");
  } catch (e) {
    console.error(`  fastdl form submit failed: ${e.message}`);
    return { shortcode, error: "fastdl-form" };
  }

  // 2. Wait for results
  let downloadLinks = [];
  try {
    await page.waitForSelector(".output-list__item", { timeout: 25000 });
    await page.waitForTimeout(1500);
    downloadLinks = await page.$$eval(".output-list__item", (items) =>
      items
        .map((item) => {
          const anchor = item.querySelector('a.button[href], a[href*="download"], a[download]');
          if (!anchor) return null;
          const href = anchor.href;
          const text = (anchor.innerText || "").toLowerCase();
          const isVideo = text.includes("video") || text.includes("mp4");
          return { link: href, hintType: isVideo ? "video" : "image" };
        })
        .filter(Boolean)
    );
    console.log(`  fastdl returned ${downloadLinks.length} links`);
  } catch (e) {
    console.error(`  fastdl results failed: ${e.message}`);
    return { shortcode, error: "fastdl-results" };
  }

  if (downloadLinks.length === 0) return { shortcode, error: "no-links" };

  // 3. Download each
  const media = [];
  for (let i = 0; i < downloadLinks.length; i++) {
    const { link, hintType } = downloadLinks[i];
    const tempName = `${shortcode}-${VERSION}-${i + 1}.tmp`;
    const tempPath = path.join(IMAGES_DIR, tempName);
    console.log(`  [${i + 1}/${downloadLinks.length}] downloading...`);
    try {
      await downloadFile(link, tempPath);
    } catch (e) {
      console.error(`     failed: ${e.message}`);
      continue;
    }
    const detected = detectFileType(tempPath);
    const finalType = detected !== "unknown" ? detected : hintType;
    const ext = finalType === "video" ? "mp4" : "jpg";
    const finalName = `${shortcode}-${VERSION}-${i + 1}.${ext}`;
    const finalDir = finalType === "video" ? VIDEOS_DIR : IMAGES_DIR;
    const finalPath = path.join(finalDir, finalName);
    fs.renameSync(tempPath, finalPath);
    const sizeKB = Math.round(fs.statSync(finalPath).size / 1024);
    console.log(`     → ${finalName} (${finalType}, ${sizeKB} KB)`);
    media.push({
      type: finalType,
      src: `/${finalType === "video" ? "videos" : "images"}/blog/${finalName}`,
      sizeKB,
    });
  }

  // small delay between posts
  await page.waitForTimeout(1500);

  return { shortcode, media };
}

async function main() {
  ensureDir(IMAGES_DIR);
  ensureDir(VIDEOS_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  for (const sc of SHORTCODES) {
    const r = await processOne(page, sc);
    results.push(r);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n\n📊 Summary:`);
  for (const r of results) {
    if (r.error) console.log(`  ❌ ${r.shortcode}: ${r.error}`);
    else console.log(`  ✅ ${r.shortcode}: ${r.media.length} media items`);
  }
  console.log(`\nWrote ${OUT_FILE}`);

  await browser.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
