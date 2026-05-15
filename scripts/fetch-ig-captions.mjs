/**
 * Fetch caption + date + media-count preview for a list of IG shortcodes.
 * Tries og:meta first (fast, no login needed), then falls back to DOM h1.
 *
 * Output: scripts/ig-captions-may2026.json
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const SHORTCODES = [
  "DYUTmKAMy6s",
  "DYSD4QNDCvi",
  "DX9N9mFDPGs",
  "DXyrwK6sV1b",
  "DXqyWeeDMzC",
  "DTsKmdmjFgF", // previously excluded — re-check what it is
];

const OUT_FILE = path.resolve("scripts/ig-captions-may2026.json");

async function fetchOne(page, shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/`;
  console.log(`\n→ ${shortcode}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const get = (sel, attr = "content") => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(attr) : null;
      };
      const ogTitle = get('meta[property="og:title"]');
      const ogDesc = get('meta[property="og:description"]');
      const ogImage = get('meta[property="og:image"]');
      const ogVideo = get('meta[property="og:video"]');
      const time = document.querySelector("time[datetime]");
      const h1 = document.querySelector("h1");
      const article = document.querySelector("article");
      // count images visible
      const imgs = document.querySelectorAll('article img[src*="scontent"]');
      const vids = document.querySelectorAll("article video");
      return {
        ogTitle,
        ogDesc,
        hasImage: !!ogImage,
        hasVideo: !!ogVideo,
        date: time ? time.getAttribute("datetime") : null,
        h1Text: h1 ? h1.innerText : null,
        articlePreview: article ? article.innerText.slice(0, 800) : null,
        imgCount: imgs.length,
        vidCount: vids.length,
      };
    });

    // Heuristic: og:description often holds caption snippet like:
    //   "37 likes, 2 comments - onecompany.global on November 12, 2026: \"<caption>...\""
    let captionGuess = null;
    if (data.ogDesc) {
      const m = data.ogDesc.match(/:\s*"([\s\S]*?)"/);
      if (m) captionGuess = m[1];
    }
    captionGuess = captionGuess || data.h1Text || data.articlePreview || data.ogTitle;

    console.log(`   date: ${data.date}`);
    console.log(
      `   imgs: ${data.imgCount}, vids: ${data.vidCount}, hasVideo(og): ${data.hasVideo}`
    );
    console.log(`   caption: ${(captionGuess || "").slice(0, 200)}...`);

    return {
      shortcode,
      url,
      date: data.date,
      ogDesc: data.ogDesc,
      ogTitle: data.ogTitle,
      hasVideo: data.hasVideo,
      captionGuess,
      h1Text: data.h1Text,
    };
  } catch (e) {
    console.log(`   FAILED: ${e.message}`);
    return { shortcode, url, error: e.message };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "uk-UA",
  });
  const page = await context.newPage();

  const results = [];
  for (const sc of SHORTCODES) {
    const r = await fetchOne(page, sc);
    results.push(r);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Wrote ${OUT_FILE}`);
  await browser.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
