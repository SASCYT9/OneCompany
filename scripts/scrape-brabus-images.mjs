import fs from 'fs';
import path from 'path';
import https from 'https';

const dir = path.join(process.cwd(), 'public/images/shop/brabus/hq');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'en' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function download(filename, url) {
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) return Promise.resolve(true);
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) { resolve(false); return; }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(true); });
    }).on('error', () => resolve(false));
  });
}

// Pages to scrape for unique images
const PAGES = [
  { slug: 'supercars', url: 'https://www.brabus.com/en-int/cars/supercars.html' },
  { slug: 'suvs', url: 'https://www.brabus.com/en-int/cars/suvs.html' },
  { slug: 'sedans', url: 'https://www.brabus.com/en-int/cars/sedans.html' },
  { slug: 'g-class', url: 'https://www.brabus.com/en-int/cars/suvs/brabus-g-class.html' },
  { slug: 'interior', url: 'https://www.brabus.com/en-int/interior.html' },
  { slug: 'marine', url: 'https://www.brabus.com/en-int/marine.html' },
];

async function main() {
  const allUrls = new Map(); // url -> slug prefix

  for (const page of PAGES) {
    console.log(`\n🔍 Scraping: ${page.url}`);
    try {
      const html = await fetchHtml(page.url);
      
      // Find all jpg/png/webp image URLs
      const regex = /https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/gi;
      const matches = html.match(regex) || [];
      
      // Filter for large images (skip thumbnails/icons by checking for resolution hints)
      const hqMatches = matches.filter(u => {
        const lower = u.toLowerCase();
        // Skip tiny images
        if (lower.includes('icon') || lower.includes('logo') || lower.includes('favicon')) return false;
        // Prefer images with resolution hints suggesting large size
        if (lower.includes('1387x780') || lower.includes('1920x') || lower.includes('1536x') || lower.includes('1200x')) return true;
        // Also accept images from _Resources/Persistent which are content images
        if (lower.includes('_resources/persistent')) return true;
        return false;
      });

      for (const url of hqMatches) {
        if (!allUrls.has(url)) {
          allUrls.set(url, page.slug);
        }
      }
      console.log(`   Found ${hqMatches.length} HQ images (${allUrls.size} total unique)`);
    } catch (err) {
      console.log(`   ⚠️ Failed to fetch: ${err.message}`);
    }
  }

  console.log(`\n📦 Total unique HQ images found: ${allUrls.size}`);
  console.log('Downloading...\n');

  let idx = 0;
  let success = 0;
  const manifest = {};

  for (const [url, slug] of allUrls) {
    const filename = `brabus-${slug}-${idx}.jpg`;
    const ok = await download(filename, url);
    if (ok) {
      // Check file size - skip if < 10KB (probably broken/tiny)
      const stat = fs.statSync(path.join(dir, filename));
      if (stat.size < 10000) {
        fs.unlinkSync(path.join(dir, filename));
        console.log(`   ⬥ Skipped ${filename} (${(stat.size/1024).toFixed(0)}KB too small)`);
      } else {
        console.log(`   ✅ ${filename} (${(stat.size/1024).toFixed(0)}KB)`);
        manifest[filename] = { url, slug, size: stat.size };
        success++;
      }
    } else {
      console.log(`   ❌ Failed: ${filename}`);
    }
    idx++;
  }

  // Write manifest for reference
  fs.writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n🎉 Done! Downloaded ${success} unique HQ images.`);
  console.log(`   Manifest saved to public/images/shop/brabus/hq/_manifest.json`);
}

main();
