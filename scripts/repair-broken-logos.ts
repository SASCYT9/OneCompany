
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const TARGETS = [
  { name: "Alpha Racing", domain: "alpharacing.com" },
  { name: "Austin Racing", domain: "austinracing.com" },
  { name: "Brembo", domain: "brembo.com" },
  { name: "CNC Racing", domain: "cncracing.com" },
  { name: "Cordona", domain: "cordona.net" },
  { name: "Bonamici", domain: "bonamici.it" }
];

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos');
const MAPPING_FILE = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');

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

    // Check if it's actually an image
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      console.log(`Skipping ${url}: Invalid content type ${contentType}`);
      return false;
    }

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

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      let score = 0;
      const srcLower = src.toLowerCase();
      const alt = ($(el).attr('alt') || '').toLowerCase();

      // Prefer SVG
      if (srcLower.endsWith('.svg')) score += 20;
      else if (srcLower.endsWith('.png')) score += 10;
      else return; // Skip JPGs to avoid white backgrounds

      if (srcLower.includes('logo')) score += 5;
      if (alt.includes('logo')) score += 5;
      if (srcLower.includes('white')) score -= 5; // Avoid white-on-transparent if we can't see it, but actually we WANT white for dark mode... 
      // Wait, if we get a white logo on transparent, it will work with the filter (black->white).
      // If we get a black logo on transparent, it will work (black->white).
      // We just want to avoid SOLID backgrounds. SVGs usually don't have backgrounds. PNGs might.

      if (score > 0) {
        try {
          const absoluteUrl = new URL(src, url).href;
          candidates.push({ url: absoluteUrl, score });
        } catch (e) {}
      }
    });

    if (candidates.length === 0) return null;
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
      const regex = new RegExp(`"${brand}":\\s*"[^"]*"`);
      if (regex.test(content)) {
        content = content.replace(regex, `"${brand}": "${path}"`);
      }
    }
    
    fs.writeFileSync(MAPPING_FILE, content);
    console.log('Updated brandLogos.ts');
  }
}

main();
