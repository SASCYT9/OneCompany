// Fetches og:image from Instagram post pages and saves them locally
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const posts = [
  { id: 'DTsKmdmjFgF', slug: 'onecompany-premium-import' },
  { id: 'DTu98JODL1s', slug: 'akrapovic-titanium' },
  { id: 'DTx1PMAjARI', slug: 'adro-bmw-g8x-carbon' },
  { id: 'DT0NWC8DCsl', slug: 'eventuri-intake' },
  { id: 'DT-XLbLjQEb', slug: 'ipe-exhaust-valvetronic' },
  { id: 'DT-4lpxDFRy', slug: 'ct-carbon-rsq8' },
  { id: 'DUGFrvdDCzP', slug: 'brabus-performance' },
  { id: 'DUImF4bjCgv', slug: 'urban-range-rover-widetrack' },
  { id: 'DUTF_x9DPIl', slug: '3d-design-bmw-exhaust-tips' },
  { id: 'DUbIS32DOtX', slug: 'darwinpro-bmw8-widetrack' },
];

const outDir = join(process.cwd(), 'public', 'images', 'blog');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

async function fetchOgImage(shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    // Try og:image
    const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/);
    if (ogMatch) return ogMatch[1];
    // Try meta image
    const metaMatch = html.match(/name="twitter:image"\s+content="([^"]+)"/);
    if (metaMatch) return metaMatch[1];
    // Try any instagram CDN url  
    const cdnMatch = html.match(/(https:\/\/scontent[^"'\s]+\.jpg[^"'\s]*)/);
    if (cdnMatch) return cdnMatch[1];
    console.log(`  No image found for ${shortcode}`);
    return null;
  } catch (e) {
    console.log(`  Error fetching ${shortcode}: ${e.message}`);
    return null;
  }
}

async function downloadImage(imageUrl, filename) {
  try {
    const res = await fetch(imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const outPath = join(outDir, filename);
    writeFileSync(outPath, buffer);
    console.log(`  Saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.log(`  Download error: ${e.message}`);
    return false;
  }
}

console.log('Fetching Instagram post images...\n');

for (const post of posts) {
  console.log(`Processing: ${post.slug} (${post.id})`);
  const imageUrl = await fetchOgImage(post.id);
  if (imageUrl) {
    console.log(`  Found image URL`);
    await downloadImage(imageUrl, `${post.slug}.jpg`);
  }
  // Add delay between requests
  await new Promise(r => setTimeout(r, 2000));
}

console.log('\nDone!');
