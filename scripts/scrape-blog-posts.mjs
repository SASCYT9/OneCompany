/**
 * Instagram Blog Scraper for OneCompany
 * 
 * Uses fastdl.app via Playwright to:
 * 1. Extract captions from the fastdl results page
 * 2. Download all media (images + videos) with proper type detection via magic bytes
 * 3. Update site-content.json with correct titles, captions, and media
 * 
 * Usage: node scripts/scrape-blog-posts.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

// ============================================================
// CONFIG: Add shortcodes here to process
// ============================================================
const SHORTCODES = [
  "DWebA1mjNjq",
  "DWbybFkjHXp",
  "DWWGptejKmd",
  "DWPLJ-PjAwZ",
  "DVBOSsajMKr",
  "DU8slwwDP1C",
  "DU56J1EjLFg",
  "DU3a9YgDGjR"
];

const SITE_CONTENT_FILE = 'public/config/site-content.json';
const IMAGES_DIR = 'public/images/blog';
const VIDEOS_DIR = 'public/videos/blog';

// ============================================================
// HELPERS
// ============================================================

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

/**
 * Detect file type by reading magic bytes.
 * Returns 'video' for mp4/webm, 'image' for jpg/png/webp, 'unknown' otherwise.
 */
function detectFileType(filePath) {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    
    // MP4: bytes 4-8 = "ftyp"
    if (buffer.toString('utf8', 4, 8) === 'ftyp') return 'video';
    // WebM: starts with 0x1A45DFA3
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return 'video';
    // JPEG: starts with FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image';
    // PNG: starts with 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image';
    // WebP: RIFF....WEBP
    if (buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') return 'image';
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Ensure a directory exists.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  ensureDir(IMAGES_DIR);
  ensureDir(VIDEOS_DIR);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const siteContent = JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf8'));
  let processedCount = 0;

  for (const shortcode of SHORTCODES) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Processing: ${shortcode}`);
    console.log(`${'='.repeat(50)}`);
    
    const postId = "ig-" + shortcode.toLowerCase();

    // ─── Step 1: Go to fastdl.app and submit URL ───
    try {
      await page.goto('https://fastdl.app/en', { waitUntil: 'domcontentloaded' });
    } catch (e) {
      console.error(`Failed to load fastdl.app: ${e.message}`);
      continue;
    }

    await page.waitForTimeout(500);

    try {
      await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
      await page.click('.search-form__button');
    } catch (e) {
      console.error(`Failed to submit form: ${e.message}`);
      continue;
    }

    // ─── Step 2: Wait for results and extract caption ───
    let caption = '';
    try {
      await page.waitForSelector('.output-list__item', { timeout: 20000 });
      await page.waitForTimeout(1000); // Let the rest of the DOM settle
      
      // Try multiple selectors for caption
      caption = await page.evaluate(() => {
        // fastdl usually renders a description/info block
        const selectors = [
          '.output-info__description',
          '.output-info__text',
          '.output-info p',
          '.output-text',
          '.output-description',
          '.info-text',
          '.result-text'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim().length > 10) {
            return el.innerText.trim();
          }
        }
        // Last resort: look at all p tags in the output area for something meaningful
        const outputArea = document.querySelector('.output') || document.querySelector('.result');
        if (outputArea) {
          const paragraphs = outputArea.querySelectorAll('p');
          for (const p of paragraphs) {
            const text = p.innerText.trim();
            if (text.length > 20 && !text.includes('Download') && !text.includes('fastdl')) {
              return text;
            }
          }
        }
        return '';
      });
      
      console.log(`Caption from fastdl: ${caption ? caption.substring(0, 80) + '...' : '(none found)'}`);
    } catch (e) {
      console.error(`Failed to get results: ${e.message}`);
      continue;
    }

    // ─── Step 3: Extract download links ───
    let downloadLinks = [];
    try {
      downloadLinks = await page.$$eval('.output-list__item', items => {
        return items.map(item => {
          const anchor = item.querySelector('a.button[href], a[href*="download"], a[download]');
          if (!anchor) return null;
          const href = anchor.href;
          const text = (anchor.innerText || '').toLowerCase();
          // Determine type from button text
          const isVideo = text.includes('video') || text.includes('mp4');
          return { link: href, hintType: isVideo ? 'video' : 'image' };
        }).filter(Boolean);
      });
      console.log(`Found ${downloadLinks.length} download links`);
    } catch (e) {
      console.error(`Failed to extract download links: ${e.message}`);
      continue;
    }

    if (downloadLinks.length === 0) {
      console.log(`No media found for ${shortcode}, skipping.`);
      continue;
    }

    // ─── Step 4: Download and detect real type ───
    const mediaItems = [];
    for (let i = 0; i < downloadLinks.length; i++) {
      const { link, hintType } = downloadLinks[i];
      // Download to a temp file first
      const tempName = `${shortcode}-v4-${i + 1}.tmp`;
      const tempPath = path.resolve(IMAGES_DIR, tempName);
      
      console.log(`  Downloading item ${i + 1}/${downloadLinks.length}...`);
      try {
        await downloadFile(link, tempPath);
      } catch (e) {
        console.error(`  Failed to download: ${e.message}`);
        continue;
      }

      // Detect actual file type via magic bytes
      const detectedType = detectFileType(tempPath);
      const finalType = detectedType !== 'unknown' ? detectedType : hintType;
      const ext = finalType === 'video' ? 'mp4' : 'jpg';
      const finalName = `${shortcode}-v4-${i + 1}.${ext}`;
      const finalDir = finalType === 'video' ? VIDEOS_DIR : IMAGES_DIR;
      const finalPath = path.resolve(finalDir, finalName);

      // Move from temp to final
      fs.renameSync(tempPath, finalPath);
      const fileSize = fs.statSync(finalPath).size;
      console.log(`  → ${finalName} (${finalType}, ${(fileSize / 1024).toFixed(0)} KB)`);

      mediaItems.push({
        id: `media-${postId}-${i + 1}`,
        type: finalType,
        src: `/${finalType === 'video' ? 'videos' : 'images'}/blog/${finalName}`,
        alt: `One Company - ${shortcode}`
      });
    }

    if (mediaItems.length === 0) {
      console.log(`No media downloaded for ${shortcode}, skipping.`);
      continue;
    }

    // ─── Step 5: If caption is still empty, try Instagram directly ───
    if (!caption || caption.length < 10) {
      console.log(`  Trying Instagram directly for caption...`);
      try {
        const igPage = await context.newPage();
        await igPage.goto(`https://www.instagram.com/p/${shortcode}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await igPage.waitForTimeout(2000);
        
        // Try the h1 (caption), time, and meta tags
        const igData = await igPage.evaluate(() => {
          const h1 = document.querySelector('h1');
          const time = document.querySelector('time');
          const metaDesc = document.querySelector('meta[property="og:description"]');
          return {
            caption: h1?.innerText || metaDesc?.content || '',
            date: time?.getAttribute('datetime') || ''
          };
        });
        
        if (igData.caption && igData.caption.length > 10) {
          caption = igData.caption;
          console.log(`  Got caption from IG: ${caption.substring(0, 80)}...`);
        }
        
        await igPage.close();
      } catch (e) {
        console.log(`  Instagram direct access failed: ${e.message}`);
      }
    }

    // ─── Step 6: Build the title ───
    let title = '';
    if (caption && caption.length > 10) {
      // Take first line, clean up
      title = caption.split('\n')[0].trim();
      // Remove leading emoji/hashtag clutter
      title = title.replace(/^[@#🏁🔥💥🚗✅🌏⚡️]+\s*/, '');
      if (title.length > 80) title = title.substring(0, 77) + '...';
    }
    
    if (!title || title.length < 5) {
      // Fallback: use the caption itself
      title = caption ? caption.substring(0, 60) : `One Company Post ${shortcode}`;
    }

    // ─── Step 7: Get date from Instagram (if we haven't already) ───
    let postDate = new Date().toISOString();
    try {
      // Try one more time specifically for date
      const datePage = await context.newPage();
      await datePage.goto(`https://www.instagram.com/p/${shortcode}/`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await datePage.waitForTimeout(1500);
      const dateStr = await datePage.evaluate(() => {
        const time = document.querySelector('time');
        return time ? time.getAttribute('datetime') : '';
      });
      if (dateStr) postDate = dateStr;
      await datePage.close();
    } catch {}

    // ─── Step 8: Upsert into site-content ───
    const newPost = {
      id: postId,
      slug: `brand-case-${shortcode.toLowerCase()}`,
      title: { ua: title, en: title },
      caption: { ua: caption || title, en: caption || title },
      date: postDate,
      location: { ua: "Україна", en: "Ukraine" },
      tags: ["onecompany", "tuning"],
      status: "published",
      media: mediaItems
    };

    const existingIdx = siteContent.blog.posts.findIndex(p => p.id === postId);
    if (existingIdx !== -1) {
      // Preserve caption/title if the old one was manually written and good
      const oldPost = siteContent.blog.posts[existingIdx];
      if (oldPost.title.ua !== 'One Company tuning project' && (!title || title === `One Company Post ${shortcode}`)) {
        newPost.title = oldPost.title;
        newPost.caption = oldPost.caption;
      }
      if (oldPost.date && oldPost.date !== new Date().toISOString().split('T')[0]) {
        newPost.date = oldPost.date; // keep existing date if it looks real
      }
      siteContent.blog.posts[existingIdx] = newPost;
      console.log(`  Updated existing post ${postId}`);
    } else {
      siteContent.blog.posts.push(newPost);
      console.log(`  Added new post ${postId}`);
    }

    processedCount++;
    
    // Small delay between posts to be nice to the servers
    await page.waitForTimeout(1500);
  }

  // ─── Sort posts by date descending ───
  siteContent.blog.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // ─── Save ───
  fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(siteContent, null, 2));
  console.log(`\n✅ Done! Processed ${processedCount}/${SHORTCODES.length} posts.`);

  await browser.close();
}

main().catch(console.error);
