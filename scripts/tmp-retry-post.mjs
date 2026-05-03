import { chromium } from 'playwright';
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

const shortcode = 'DWPLJ-PjAwZ';
const SITE_CONTENT_FILE = 'public/config/site-content.json';

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
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

function detectFileType(filePath) {
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);
  if (buffer.toString('utf8', 4, 8) === 'ftyp') return 'video';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image';
  return 'image';
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Get media from fastdl
  await page.goto('https://fastdl.app/en');
  await page.waitForTimeout(1000);
  await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
  await page.click('.search-form__button');
  
  await page.waitForSelector('.output-list__item', { timeout: 30000 });
  await page.waitForTimeout(1500);
  
  const links = await page.$$eval('.output-list__item a.button[href]', els => els.map(a => a.href));
  console.log(`Found ${links.length} links`);

  const postId = 'ig-' + shortcode.toLowerCase();
  const mediaItems = [];
  
  for (let i = 0; i < links.length; i++) {
    const tempPath = path.resolve('public/images/blog', `${shortcode}-v4-${i+1}.tmp`);
    console.log(`Downloading ${i+1}/${links.length}...`);
    await downloadFile(links[i], tempPath);
    
    const type = detectFileType(tempPath);
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const finalName = `${shortcode}-v4-${i+1}.${ext}`;
    const finalDir = type === 'video' ? 'public/videos/blog' : 'public/images/blog';
    const finalPath = path.resolve(finalDir, finalName);
    fs.renameSync(tempPath, finalPath);
    
    console.log(`  → ${finalName} (${type}, ${(fs.statSync(finalPath).size/1024).toFixed(0)} KB)`);
    mediaItems.push({
      id: `media-${postId}-${i+1}`,
      type,
      src: `/${type === 'video' ? 'videos' : 'images'}/blog/${finalName}`,
      alt: 'One Company'
    });
  }

  // 2. Get caption from IG
  let caption = '';
  try {
    const igPage = await context.newPage();
    await igPage.goto(`https://www.instagram.com/p/${shortcode}/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await igPage.waitForTimeout(2000);
    caption = await igPage.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      return meta ? meta.content : '';
    });
    await igPage.close();
  } catch (e) {
    console.log('IG caption failed:', e.message);
  }

  // Clean caption
  const match = caption.match(/onecompany\.global.*?:\s*"?(.+)"?$/s);
  if (match) {
    caption = match[1].replace(/"$/, '');
  }
  
  let title = caption ? caption.split('\n')[0].trim() : `One Company Post ${shortcode}`;
  if (title.length > 80) title = title.substring(0, 77) + '...';
  
  console.log(`Caption: ${title}`);

  // 3. Update JSON
  const siteContent = JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf8'));
  const idx = siteContent.blog.posts.findIndex(p => p.id === postId);
  const post = {
    id: postId,
    slug: `brand-case-${shortcode.toLowerCase()}`,
    title: { ua: title, en: title },
    caption: { ua: caption || title, en: caption || title },
    date: '2026-03-24T10:00:00.000Z',
    location: { ua: 'Україна', en: 'Ukraine' },
    tags: ['onecompany', 'tuning'],
    status: 'published',
    media: mediaItems
  };
  
  if (idx !== -1) siteContent.blog.posts[idx] = post;
  else siteContent.blog.posts.push(post);
  
  siteContent.blog.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(siteContent, null, 2));
  
  console.log('Done!');
  await browser.close();
}

main().catch(console.error);
