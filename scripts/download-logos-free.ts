import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Brand {
  name: string;
  domain?: string;
}

interface BrandWithCategory extends Brand {
  category: string;
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRANDS_LIST_PATH = path.join(process.cwd(), 'scripts', 'brands-list.json');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const MANUAL_OVERRIDES_PATH = path.join(process.cwd(), 'scripts', 'brand-logo-overrides.json');

async function loadManualOverrides(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(MANUAL_OVERRIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function normalizeOverrideLogoPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('/logos/')) return trimmed;
  return `/logos/${trimmed.replace(/^\/+/, '')}`;
}
// Priority order: SVG (best quality), WebP (great compression + quality), PNG, JPEG
const SUPPORTED_EXTENSIONS = ['.svg', '.webp', '.png', '.jpg', '.jpeg'];
const PREFERRED_FORMAT = '.webp'; // Prefer WebP for new downloads
const DELAY_MS = 1000; // Delay between requests to avoid rate limiting
const MAX_RETRIES = 3;

// Slugify function to create safe filenames
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

// Extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^www\./, '');
  }
};

// Search for brand domain using DuckDuckGo HTML search
const searchBrandDomain = async (brandName: string): Promise<string | null> => {
  try {
    console.log(`  🔍 Searching for domain: ${brandName}`);

    const searchQuery = encodeURIComponent(`${brandName} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
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
    if (axios.isAxiosError(error)) {
      console.error(`  ✗ Search failed: ${error.message}`);
    }
    return null;
  }
};

// Check if logo exists
const findExistingLogo = async (slug: string): Promise<string | null> => {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const candidate = `${slug}${extension}`;
    try {
      await fs.access(path.join(LOGO_DIR, candidate));
      return candidate;
    } catch {
      // Continue checking other extensions
    }
  }
  return null;
};

// Try to download logo from multiple sources
const downloadLogo = async (brandName: string, domain: string, slug: string): Promise<string | null> => {
  const sources = [
    // WebP sources (best compression + quality)
    {
      name: 'Logo.dev WebP',
      url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=webp&size=400`,
      extension: '.webp',
    },
    // PNG fallbacks
    {
      name: 'Clearbit',
      url: `https://logo.clearbit.com/${domain}`,
      extension: '.png',
    },
    {
      name: 'Logo.dev PNG',
      url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=400`,
      extension: '.png',
    },
    {
      name: 'Google S2',
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
      extension: '.png',
    },
    {
      name: 'Favicon',
      url: `https://${domain}/favicon.ico`,
      extension: '.ico',
    },
  ];

  // Try scraping the website for logo
  try {
    console.log(`  🌐 Scraping ${domain} for logo...`);
    const response = await axios.get(`https://${domain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Look for logo in common places
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      '.logo img',
      '#logo img',
      'header img',
      '.header img',
      '.navbar-brand img',
      'a[class*="logo" i] img',
    ];

    for (const selector of logoSelectors) {
      const logoElement = $(selector).first();
      if (logoElement.length) {
        let logoUrl = logoElement.attr('src');
        if (logoUrl) {
          // Convert relative URL to absolute
          if (logoUrl.startsWith('//')) {
            logoUrl = `https:${logoUrl}`;
          } else if (logoUrl.startsWith('/')) {
            logoUrl = `https://${domain}${logoUrl}`;
          } else if (!logoUrl.startsWith('http')) {
            logoUrl = `https://${domain}/${logoUrl}`;
          }

          // Determine file extension
          const urlExtension = path.extname(new URL(logoUrl).pathname).toLowerCase();
          const extension = SUPPORTED_EXTENSIONS.includes(urlExtension) ? urlExtension : '.png';

          sources.unshift({
            name: 'Website Scrape',
            url: logoUrl,
            extension,
          });

          console.log(`  ✓ Found logo on website: ${logoUrl}`);
          break;
        }
      }
    }
  } catch (error) {
    console.log(`  ⚠ Could not scrape website`);
  }

  // Try each source
  for (const source of sources) {
    try {
      console.log(`  📥 Trying ${source.name}...`);

      const response = await axios.get(source.url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        validateStatus: (status) => status === 200,
      });

      const buffer = Buffer.from(response.data);

      // Check if the response is actually an image
      if (buffer.length < 100) {
        console.log(`  ⚠ ${source.name}: File too small, skipping`);
        continue;
      }

      // Save the file
      const fileName = `${slug}${source.extension}`;
      const filePath = path.join(LOGO_DIR, fileName);

      await fs.writeFile(filePath, buffer);
      console.log(`  ✅ Downloaded from ${source.name}: ${fileName}`);

      return fileName;
    } catch (error) {
      console.log(`  ⚠ ${source.name}: Failed`);
    }
  }

  return null;
};

// Read brands list
const readBrandsList = async (): Promise<BrandWithCategory[]> => {
  const raw = await fs.readFile(BRANDS_LIST_PATH, 'utf-8');
  const data = JSON.parse(raw) as { categories: Record<string, string[]> };

  const brands: BrandWithCategory[] = [];

  for (const [category, brandNames] of Object.entries(data.categories)) {
    for (const name of brandNames) {
      brands.push({
        name: name.trim(),
        category,
      });
    }
  }

  return brands;
};

// Main function
const main = async () => {
  try {
    console.log('🚀 Starting logo download process...\n');

    // Create logo directory
    await fs.mkdir(LOGO_DIR, { recursive: true });
    console.log(`📁 Logo directory ready: ${LOGO_DIR}\n`);

    // Read brands list
    const brands = await readBrandsList();
    console.log(`📋 Found ${brands.length} brands to process\n`);

    const logoMap: Record<string, string> = {};
    const stats = {
      total: brands.length,
      downloaded: 0,
      reused: 0,
      failed: 0,
    };

    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const brandName = brand.name;
      const slug = slugify(brandName);

      console.log(`\n[${i + 1}/${brands.length}] Processing: ${brandName}`);

      // Check if logo already exists
      const existingLogo = await findExistingLogo(slug);
      if (existingLogo) {
        logoMap[brandName] = `/logos/${existingLogo}`;
        stats.reused++;
        console.log(`  ♻️  Using existing logo: ${existingLogo}`);
        continue;
      }

      // Search for domain
      const domain = await searchBrandDomain(brandName);

      if (!domain) {
        console.log(`  ✗ Could not find domain for ${brandName}`);
        stats.failed++;
        await delay(DELAY_MS);
        continue;
      }

      // Download logo
      await delay(DELAY_MS); // Rate limiting

      const fileName = await downloadLogo(brandName, domain, slug);

      if (fileName) {
        logoMap[brandName] = `/logos/${fileName}`;
        stats.downloaded++;
      } else {
        console.log(`  ✗ Failed to download logo for ${brandName}`);
        stats.failed++;
      }

      // Additional delay between brands
      await delay(DELAY_MS);
    }

    // Generate brandLogos.ts file
    console.log('\n📝 Generating brandLogos.ts file...');

    const manualOverrides = await loadManualOverrides();
    const overrideCount = Object.keys(manualOverrides).length;
    if (overrideCount > 0) {
      console.log(`🧩 Applying ${overrideCount} manual logo override(s) from scripts/brand-logo-overrides.json`);
      for (const [brandName, value] of Object.entries(manualOverrides)) {
        if (typeof value !== 'string' || !value.trim()) continue;
        logoMap[brandName] = normalizeOverrideLogoPath(value);
      }
    }

    let fileContent = `// This file is auto-generated by scripts/download-logos-free.ts\n\n`;
    fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;

    for (const [brandName, logoPath] of Object.entries(logoMap).sort((a, b) => a[0].localeCompare(b[0]))) {
      fileContent += `  '${brandName.replace(/'/g, "\\'")}': '${logoPath}',\n`;
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

    // Print statistics
    console.log('\n' + '='.repeat(50));
    console.log('📊 STATISTICS');
    console.log('='.repeat(50));
    console.log(`Total brands:      ${stats.total}`);
    console.log(`Downloaded:        ${stats.downloaded} ✅`);
    console.log(`Reused existing:   ${stats.reused} ♻️`);
    console.log(`Failed:            ${stats.failed} ❌`);
    console.log(`Success rate:      ${((stats.downloaded + stats.reused) / stats.total * 100).toFixed(1)}%`);
    console.log('='.repeat(50));
    console.log(`\n✨ Brand logo map saved to: ${BRAND_LOGOS_PATH}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

main();
