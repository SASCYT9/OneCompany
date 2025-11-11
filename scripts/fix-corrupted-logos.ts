
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const SUPPORTED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico'];
const DELAY_MS = 1500;

const BRANDS_TO_FIX = [
  { name: 'APR', slug: 'apr' },
  { name: 'CT Carbon', slug: 'ct-carbon' },
  { name: 'DMS Shocks', slug: 'dms-shocks' },
  { name: 'LOBA Motorsport', slug: 'loba-motorsport' },
  { name: 'VR Tuned', slug: 'vr-tuned' },
];

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

const searchBrandDomain = async (brandName: string): Promise<string | null> => {
  try {
    console.log(`  🔍 Searching for domain: ${brandName}`);
    const searchQuery = encodeURIComponent(`${brandName} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 10000,
    });
    const $ = cheerio.load(response.data);
    const firstResult = $('.result__url').first().text().trim();
    if (firstResult) {
      const domain = extractDomain(firstResult);
      console.log(`  ✓ Found domain: ${domain}`);
      return domain;
    }
    return null;
  } catch (error) {
    console.error(`  ✗ Search failed for ${brandName}:`, error);
    return null;
  }
};

const deleteExistingLogo = async (slug: string) => {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const filePath = path.join(LOGO_DIR, `${slug}${extension}`);
    try {
      await fs.unlink(filePath);
      console.log(`  🗑️ Deleted existing logo: ${path.basename(filePath)}`);
      return;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`  ✗ Error deleting ${filePath}:`, error);
      }
    }
  }
};

const downloadHighQualityLogo = async (domain: string, slug: string): Promise<string | null> => {
    const sources = [
    { name: 'Clearbit (High-Res)', url: `https://logo.clearbit.com/${domain}?size=512`, extension: '.png' },
    { name: 'Logo.dev', url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=512`, extension: '.png' },
    { name: 'Icon Horse (High-Res)', url: `https://icon.horse/icon/${domain}`, extension: '.png' },
    { name: 'Google S2 (High-Res)', url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`, extension: '.png' },
  ];

  for (const source of sources) {
    try {
      console.log(`  📥 Trying ${source.name}...`);
      const response = await axios.get(source.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0...' },
        validateStatus: (status) => status === 200,
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length < 1024) { // Skip tiny files (likely favicons or errors)
        console.log(`  ⚠ ${source.name}: File too small (${buffer.length} bytes), skipping.`);
        continue;
      }

      const fileName = `${slug}${source.extension}`;
      const filePath = path.join(LOGO_DIR, fileName);
      await fs.writeFile(filePath, buffer);
      console.log(`  ✅ Downloaded from ${source.name}: ${fileName}`);
      return fileName;
    } catch (error) {
      console.log(`  ⚠ ${source.name} failed.`);
    }
  }
  return null;
};


const main = async () => {
  console.log('🚀 Starting script to fix corrupted logos...');

  for (const brand of BRANDS_TO_FIX) {
    console.log(`\n[FIXING] ==> ${brand.name}`);
    
    // 1. Delete old logo
    await deleteExistingLogo(brand.slug);

    // 2. Find domain
    const domain = await searchBrandDomain(brand.name);
    if (!domain) {
      console.log(`  ✗ Could not find domain for ${brand.name}. Skipping.`);
      continue;
    }

    await delay(DELAY_MS);

    // 3. Download new logo
    const newLogoFile = await downloadHighQualityLogo(domain, brand.slug);

    if (newLogoFile) {
      console.log(`  🎉 Successfully fixed logo for ${brand.name}! New file: ${newLogoFile}`);
    } else {
      console.log(`  😭 Failed to fix logo for ${brand.name}.`);
    }
  }

  console.log('\n\n✅ Script finished. Please run `npm run generate-brand-logos` and `npm run verify-logos` to confirm fixes.');
};

main();
