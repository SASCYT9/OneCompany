
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
// Removed unused import

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos');
const MAPPING_FILE = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const SOLID_LOGOS_FILE = path.join(process.cwd(), 'scripts', 'dark-logos.json');

// Load the list of solid logos we detected
const solidLogos = JSON.parse(fs.readFileSync(SOLID_LOGOS_FILE, 'utf-8')) as string[];

// Map filenames back to brand names
// We need to find which brand corresponds to which file
// We can use the brandLogos.ts file or just reverse engineer from filename
// But better to iterate through all brands and check if their current logo is in the solid list

// Helper to normalize brand name to filename
function getBrandFilename(brandName: string): string | null {
  // This is tricky because we don't know the extension.
  // We have to look up in brandLogos.ts or check file existence.
  // Let's read brandLogos.ts to get the current mapping.
  const mappingContent = fs.readFileSync(MAPPING_FILE, 'utf-8');
  const match = mappingContent.match(new RegExp(`"${brandName}":\\s*"/logos/([^"]+)"`));
  if (match) {
    return match[1];
  }
  return null;
}

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

    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) return false;

    fs.writeFileSync(destPath, response.data);
    return true;
  } catch (error) {
    return false;
  }
}

async function scrapeLogo(brandName: string): Promise<string | null> {
  // Try to guess domain
  const domain = brandName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const url = `https://${domain}`;
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
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

      // Strong preference for SVG
      if (srcLower.endsWith('.svg')) score += 50;
      else if (srcLower.endsWith('.png')) score += 10;
      else return; // Skip JPGs entirely

      if (srcLower.includes('logo')) score += 5;
      if (alt.includes('logo')) score += 5;
      
      // Penalize white logos if we can detect them (hard)
      // But generally SVGs are safe.

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
    // console.error(`Error scraping ${url}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  console.log(`Attempting to upgrade ${solidLogos.length} solid logos...`);
  
  // We need to map solid files back to brand names
  // Read brandLogos.ts
  const mappingContent = fs.readFileSync(MAPPING_FILE, 'utf-8');
  const brandMap: Record<string, string> = {}; // filename -> brandName
  
  // Parse the file manually or regex
  const lines = mappingContent.split('\n');
  for (const line of lines) {
    const match = line.match(/"([^"]+)":\s*"\/logos\/([^"]+)"/);
    if (match) {
      brandMap[match[2]] = match[1];
    }
  }

  let successCount = 0;

  for (const filename of solidLogos) {
    const brandName = brandMap[filename];
    if (!brandName) {
      console.log(`Skipping ${filename} (unknown brand)`);
      continue;
    }

    console.log(`Upgrading ${brandName} (${filename})...`);
    const newLogoUrl = await scrapeLogo(brandName);
    
    if (newLogoUrl) {
      const ext = path.extname(new URL(newLogoUrl).pathname) || '.png';
      // If we found an SVG, great!
      if (ext === '.svg' || ext === '.png') {
         const newFilename = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + ext;
         const destPath = path.join(LOGOS_DIR, newFilename);
         
         const success = await downloadImage(newLogoUrl, destPath);
         if (success) {
           console.log(`  -> Replaced with ${newFilename}`);
           
           // Update mapping
           let currentContent = fs.readFileSync(MAPPING_FILE, 'utf-8');
           const regex = new RegExp(`"${brandName}":\\s*"/logos/[^"]+"`);
           currentContent = currentContent.replace(regex, `"${brandName}": "/logos/${newFilename}"`);
           fs.writeFileSync(MAPPING_FILE, currentContent);
           
           successCount++;
         }
      }
    } else {
      console.log(`  -> No better logo found.`);
    }
  }
  
  console.log(`\nUpgrade complete. Fixed ${successCount} logos.`);
}

main();
