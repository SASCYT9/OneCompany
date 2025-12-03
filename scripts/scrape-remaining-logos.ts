
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

// Only target the ones that failed previously
const TARGETS = [
  { name: "Tth Turbos", domain: "www.turbo-technik-hamburg.de" }
];

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos');
const MAPPING_FILE = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');

// Disable SSL verification for these problematic sites
const httpsAgent = new https.Agent({  
  rejectUnauthorized: false
});

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    fs.writeFileSync(destPath, response.data);
    return true;
  } catch (error) {
    console.error(`Failed to download ${url}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function scrapeLogo(brand: { name: string, domain: string }): Promise<string | null> {
  const url = `https://${brand.domain}`;
  console.log(`Scraping ${url}...`);

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const candidates: { url: string, score: number }[] = [];

    // 1. Check OpenGraph image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) candidates.push({ url: ogImage, score: 10 });

    // 2. Check Twitter image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) candidates.push({ url: twitterImage, score: 9 });

    // 3. Check all img tags
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      let score = 0;
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const className = ($(el).attr('class') || '').toLowerCase();
      const id = ($(el).attr('id') || '').toLowerCase();
      const srcLower = src.toLowerCase();

      // Boost score for "logo" in attributes
      if (srcLower.includes('logo')) score += 5;
      if (alt.includes('logo')) score += 3;
      if (className.includes('logo')) score += 3;
      if (id.includes('logo')) score += 3;
      
      // Boost for brand name
      const brandSlug = brand.name.toLowerCase().replace(/\s+/g, '');
      if (srcLower.includes(brandSlug)) score += 4;
      if (alt.includes(brand.name.toLowerCase())) score += 4;

      // Penalties
      if (srcLower.includes('footer')) score -= 2;
      if (srcLower.includes('icon')) score -= 1;
      if (srcLower.endsWith('.gif')) score -= 5;

      if (score > 0) {
        // Resolve relative URLs
        try {
          const absoluteUrl = new URL(src, url).href;
          candidates.push({ url: absoluteUrl, score });
        } catch (e) {
          // Invalid URL
        }
      }
    });

    // 4. Check favicon as fallback
    const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
    if (favicon) {
       try {
          const absoluteUrl = new URL(favicon, url).href;
          candidates.push({ url: absoluteUrl, score: 1 });
        } catch (e) {}
    }

    if (candidates.length === 0) return null;

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].url;

  } catch (error) {
    console.error(`Error scraping ${url}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  const results: Record<string, string> = {};

  for (const brand of TARGETS) {
    const logoUrl = await scrapeLogo(brand);
    if (logoUrl) {
      console.log(`Found candidate for ${brand.name}: ${logoUrl}`);
      
      const ext = path.extname(new URL(logoUrl).pathname) || '.png';
      const filename = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + ext;
      const destPath = path.join(LOGOS_DIR, filename);
      
      const success = await downloadImage(logoUrl, destPath);
      if (success) {
        console.log(`Successfully saved to ${filename}`);
        results[brand.name] = `/logos/${filename}`;
      }
    } else {
      console.log(`No logo found for ${brand.name}`);
    }
  }

  // Update mapping file
  if (Object.keys(results).length > 0) {
    let content = fs.readFileSync(MAPPING_FILE, 'utf-8');
    
    for (const [brand, path] of Object.entries(results)) {
      // Look for the brand in the mapping
      const regex = new RegExp(`"${brand}":\\s*"[^"]*"`);
      if (regex.test(content)) {
        content = content.replace(regex, `"${brand}": "${path}"`);
      } else {
        // If not found (unlikely for this task), insert it
        // This is a simple append for now, assuming the structure is consistent
        console.log(`Warning: Could not find entry for ${brand} to update.`);
      }
    }
    
    fs.writeFileSync(MAPPING_FILE, content);
    console.log('Updated brandLogos.ts');
  }
}

main();
