import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

const OUTPUT_DIR = path.resolve('public/images/blog');

const shortcodes = [
  'DWn0fWMjB1t',
  'DWTU9BsDEJC',
  'DVG3S66DAgX'
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : require('http');
    client.get(url, (res) => {
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

async function main() {
  console.log('🚀 Launching Chrome to download reels...');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  
  for (const shortcode of shortcodes) {
    console.log(`\n📸 Checking ${shortcode}...`);
    let videoUrl = null;
    
    const handler = (response) => {
      const url = response.url();
      if ((url.includes('.mp4') || response.headers()['content-type'] === 'video/mp4') && !videoUrl) {
        videoUrl = url;
        console.log('Found video URL!');
      }
    };
    
    page.on('response', handler);
    
    await page.goto(`https://www.instagram.com/p/${shortcode}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(4000);
    
    // Also check DOM for video tags
    if (!videoUrl) {
      videoUrl = await page.evaluate(() => {
        const vid = document.querySelector('video');
        return vid ? vid.src : null;
      });
    }
    
    page.off('response', handler);
    
    if (videoUrl) {
      console.log(`Downloading video for ${shortcode}...`);
      await downloadFile(videoUrl, path.join(OUTPUT_DIR, `${shortcode}.mp4`));
      console.log(`✅ Saved ${shortcode}.mp4`);
    } else {
      console.log(`❌ No video found for ${shortcode}`);
    }
  }
  
  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
