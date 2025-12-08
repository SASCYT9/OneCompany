import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface MotoBrand {
  name: string;
  url: string;
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const MOTO_BRANDS_PATH = path.join(process.cwd(), 'scripts', 'moto-brands.json');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const SUPPORTED_EXTENSIONS = ['.svg', '.webp', '.png', '.jpg', '.jpeg'];

// Headers to mimic a real browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '');
  }
};

const downloadFile = async (url: string, filepath: string): Promise<boolean> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: HEADERS,
      timeout: 15000,
    });
    await fs.writeFile(filepath, response.data);
    return true;
  } catch (error) {
    return false;
  }
};

const deleteExistingLogos = async (slug: string) => {
  for (const ext of SUPPORTED_EXTENSIONS) {
    const filepath = path.join(LOGO_DIR, `${slug}${ext}`);
    try {
      await fs.unlink(filepath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
};

const findLogoOnPage = async (url: string, domain: string): Promise<string | null> => {
  try {
    console.log(`    Trying to scrape ${url}...`);
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data);
    
    const candidates: { url: string; score: number }[] = [];

    // 1. Check for SVG logos specifically
    $('img[src$=".svg"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) candidates.push({ url: src, score: 100 });
    });

    // 2. Check common logo selectors
    const selectors = [
      'link[rel="icon"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      '.logo img',
      '#logo img',
      'header img',
      'a[class*="brand"] img',
      'img[alt*="logo" i]',
    ];

    selectors.forEach(selector => {
      $(selector).each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('href') || $(el).attr('content');
        if (src) {
          let score = 50;
          if (src.endsWith('.svg')) score += 40;
          if (src.includes('logo')) score += 20;
          candidates.push({ url: src, score });
        }
      });
    });

    // Sort by score
    candidates.sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      let finalUrl = candidate.url;
      if (finalUrl.startsWith('//')) {
        finalUrl = `https:${finalUrl}`;
      } else if (finalUrl.startsWith('/')) {
        finalUrl = `${new URL(url).origin}${finalUrl}`;
      } else if (!finalUrl.startsWith('http')) {
        finalUrl = `${new URL(url).origin}/${finalUrl}`;
      }
      
      // Verify it's a valid image url
      if (finalUrl.match(/\.(svg|png|webp|jpg|jpeg)(\?.*)?$/i)) {
         return finalUrl;
      }
    }

    return null;
  } catch (error) {
    console.log(`    Scraping failed: ${(error as Error).message}`);
    return null;
  }
};

const main = async () => {
  try {
    const brandsData = await fs.readFile(MOTO_BRANDS_PATH, 'utf-8');
    const brands: MotoBrand[] = JSON.parse(brandsData);
    
    console.log(`🚀 Starting high-quality logo update for ${brands.length} brands...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const brand of brands) {
      const slug = slugify(brand.name);
      const domain = extractDomain(brand.url);
      
      console.log(`\nProcessing: ${brand.name} (${domain})`);
      
      // 1. Delete existing logos to force update
      await deleteExistingLogos(slug);

      let downloaded = false;

      // 2. Try WorldVectorLogo first (High Quality SVGs)
      if (!downloaded) {
        const wvlUrl = `https://cdn.worldvectorlogo.com/logos/${slug}.svg`;
        console.log(`  Trying WorldVectorLogo...`);
        if (await downloadFile(wvlUrl, path.join(LOGO_DIR, `${slug}.svg`))) {
          console.log(`  ✅ Downloaded SVG from WorldVectorLogo`);
          downloaded = true;
        }
      }

      // 3. Try Official Website Scraping
      if (!downloaded) {
        console.log(`  Scraping official site...`);
        const logoUrl = await findLogoOnPage(brand.url, domain);
        if (logoUrl) {
          const ext = path.extname(new URL(logoUrl).pathname) || '.png';
          if (await downloadFile(logoUrl, path.join(LOGO_DIR, `${slug}${ext}`))) {
            console.log(`  ✅ Downloaded from official site: ${logoUrl}`);
            downloaded = true;
          }
        }
      }

      // 4. Fallback: Clearbit (Reliable PNGs)
      if (!downloaded) {
        console.log(`  Trying Clearbit fallback...`);
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        if (await downloadFile(clearbitUrl, path.join(LOGO_DIR, `${slug}.png`))) {
          console.log(`  ✅ Downloaded PNG from Clearbit`);
          downloaded = true;
        }
      }
      
      // 5. Fallback: Google S2
      if (!downloaded) {
         console.log(`  Trying Google S2 fallback...`);
         const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
         if (await downloadFile(googleUrl, path.join(LOGO_DIR, `${slug}.png`))) {
            console.log(`  ✅ Downloaded PNG from Google S2`);
            downloaded = true;
         }
      }

      if (downloaded) {
        successCount++;
      } else {
        console.log(`  ❌ Failed to download logo for ${brand.name}`);
        failCount++;
      }

      await delay(1000); // Be nice to servers
    }

    // Regenerate map
    console.log('\n📝 Regenerating brandLogos.ts...');
    const files = await fs.readdir(LOGO_DIR);
    const logoMap: Record<string, string> = {};
    
    // Re-read all brands to ensure we map everything correctly, including existing ones
    // Actually, we should scan the directory and map slugs back to names if possible, 
    // or just map the ones we know. 
    // Better approach: Read the existing map, update it with new files, and write it back.
    // But the previous script regenerates it from scratch based on file existence.
    // Let's do a simple scan of the directory.
    
    for (const file of files) {
      if (SUPPORTED_EXTENSIONS.includes(path.extname(file))) {
        const name = path.basename(file, path.extname(file));
        // Try to find original name from our list if possible, otherwise use slug
        const originalBrand = brands.find(b => slugify(b.name) === name);
        const key = originalBrand ? originalBrand.name : name; // This might lose capitalization for others, but it's safe
        logoMap[key] = `/logos/${file}`;
      }
    }

    // We need to preserve the capitalization of brands NOT in our list.
    // So let's read the OLD map first? 
    // Actually, the previous script `download-logos-free.ts` logic was:
    // Iterate through `brands-list.json` (or `brands-to-fetch.json`) and check if file exists.
    // Here we only have a partial list.
    // To be safe, let's just run the map generation logic that scans the folder 
    // and tries to match against known lists.
    
    // Let's read the BIG list to get proper casing for other brands
    let allBrands: {name: string}[] = [];
    try {
        const bigListPath = path.join(process.cwd(), 'scripts', 'brands-list.json');
        const bigListRaw = await fs.readFile(bigListPath, 'utf-8');
        const bigListJson = JSON.parse(bigListRaw);
        // Flatten categories
        Object.values(bigListJson.categories).forEach((arr: any) => {
            arr.forEach((b: string) => allBrands.push({name: b}));
        });
    } catch (e) {
        console.log('Could not read master brand list, using slugs for others.');
    }
    
    // Merge our moto brands into allBrands
    brands.forEach(b => allBrands.push({name: b.name}));

    let fileContent = `// This file is auto-generated by scripts/download-moto-logos.ts\n\n`;
    fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;

    const sortedFiles = files.filter(f => SUPPORTED_EXTENSIONS.includes(path.extname(f))).sort();
    
    for (const file of sortedFiles) {
        const slug = path.basename(file, path.extname(file));
        // Find best matching name
        const match = allBrands.find(b => slugify(b.name) === slug);
        const displayName = match ? match.name : slug; // Fallback to slug if unknown
        
        fileContent += `  '${displayName.replace(/'/g, "\\'")}': '/logos/${file}',\n`;
    }

    fileContent += `};\n\n`;
    fileContent += `const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(\n`;
    fileContent += `  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])\n`;
    fileContent += `);\n\n`;
    fileContent += `export const getBrandLogo = (brandName: string): string => {\n`;
    fileContent += `  if (!brandName) {\n`;
    fileContent += `    return '/logos/placeholder.svg';\n`;
    fileContent += `  }\n`;
    fileContent += `\n`;
    fileContent += `  const normalizedName = brandName.trim().toLowerCase();\n`;
    fileContent += `  return (\n`;
    fileContent += `    BRAND_LOGO_MAP[brandName] ||\n`;
    fileContent += `    NORMALIZED_BRAND_LOGO_MAP[normalizedName] ||\n`;
    fileContent += `    '/logos/placeholder.svg'\n`;
    fileContent += `  );\n`;
    fileContent += `};\n`;

    await fs.writeFile(BRAND_LOGOS_PATH, fileContent, 'utf-8');
    
    console.log(`\n✨ Done! Success: ${successCount}, Failed: ${failCount}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
};

main();
