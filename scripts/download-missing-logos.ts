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
const MISSING_BRANDS_PATH = path.join(process.cwd(), 'scripts', 'missing-brands.json');
const MANUAL_DOMAINS_PATH = path.join(process.cwd(), 'scripts', 'manual-domains.json');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const SUPPORTED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
const DELAY_MS = 1500; // Increased delay for missing brands
const MAX_RETRIES = 3;

let MANUAL_DOMAINS: Record<string, string> = {};

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
  // First, check manual domains mapping
  if (MANUAL_DOMAINS[brandName]) {
    const domain = MANUAL_DOMAINS[brandName];
    console.log(`  ✓ Found domain in manual mapping: ${domain}`);
    return domain;
  }

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

const downloadLogo = async (brandName: string, domain: string, slug: string): Promise<string | null> => {
  const sources = [
    {
      name: 'Clearbit',
      url: `https://logo.clearbit.com/${domain}`,
      extension: '.png',
    },
    {
      name: 'Logo.dev',
      url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=400`,
      extension: '.png',
    },
    {
      name: 'Icon Horse',
      url: `https://icon.horse/icon/${domain}`,
      extension: '.png',
    },
    {
      name: 'Favicone',
      url: `https://favicone.com/${domain}?s=256`,
      extension: '.png',
    },
    {
      name: 'Google S2',
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
      extension: '.png',
    },
    {
      name: 'DuckDuckGo Icon',
      url: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      extension: '.png',
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
          if (logoUrl.startsWith('//')) {
            logoUrl = `https:${logoUrl}`;
          } else if (logoUrl.startsWith('/')) {
            logoUrl = `https://${domain}${logoUrl}`;
          } else if (!logoUrl.startsWith('http')) {
            logoUrl = `https://${domain}/${logoUrl}`;
          }

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

      if (buffer.length < 100) {
        console.log(`  ⚠ ${source.name}: File too small, skipping`);
        continue;
      }

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

const readBrandsList = async (): Promise<BrandWithCategory[]> => {
  const raw = await fs.readFile(MISSING_BRANDS_PATH, 'utf-8');
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

const main = async () => {
  try {
    console.log('🚀 Starting MISSING logos download...\n');

    await fs.mkdir(LOGO_DIR, { recursive: true });

    // Load manual domains mapping
    try {
      const manualDomainsRaw = await fs.readFile(MANUAL_DOMAINS_PATH, 'utf-8');
      const manualDomainsData = JSON.parse(manualDomainsRaw) as { domains: Record<string, string> };
      MANUAL_DOMAINS = manualDomainsData.domains;
      console.log(`📚 Loaded ${Object.keys(MANUAL_DOMAINS).length} manual domain mappings\n`);
    } catch (error) {
      console.log('⚠️  No manual domains file found, will use search only\n');
    }

    const brands = await readBrandsList();
    console.log(`📋 Found ${brands.length} MISSING brands to process\n`);

    const stats = {
      total: brands.length,
      downloaded: 0,
      failed: 0,
    };

    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const brandName = brand.name;
      const slug = slugify(brandName);

      console.log(`\n[${i + 1}/${brands.length}] Processing: ${brandName}`);

      // Check if already exists
      const existingLogo = await findExistingLogo(slug);
      if (existingLogo) {
        console.log(`  ⚠️ Logo already exists: ${existingLogo}`);
        continue;
      }

      // Search for domain
      const domain = await searchBrandDomain(brandName);
      await delay(DELAY_MS);

      if (!domain) {
        console.log(`  ✗ Could not find domain for ${brandName}`);
        stats.failed++;
        continue;
      }

      // Download logo
      const fileName = await downloadLogo(brandName, domain, slug);

      if (fileName) {
        stats.downloaded++;
      } else {
        console.log(`  ✗ Failed to download logo for ${brandName}`);
        stats.failed++;
      }

      await delay(DELAY_MS);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL STATISTICS');
    console.log('='.repeat(50));
    console.log(`Total missing brands: ${stats.total}`);
    console.log(`Downloaded:           ${stats.downloaded} ✅`);
    console.log(`Failed:               ${stats.failed} ❌`);
    console.log(`Success rate:         ${(stats.downloaded / stats.total * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    console.log('\n⚠️  Now run: npm run download-logos-free');
    console.log('   to regenerate brandLogos.ts with all logos');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

main();
