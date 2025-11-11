import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { execSync } from 'child_process';

interface BrandDomain {
  name: string;
  domain: string;
  slug: string;
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const MANUAL_DOMAINS_PATH = path.join(process.cwd(), 'scripts', 'manual-domains.json');
const BRANDS_PATH = path.join(process.cwd(), 'src', 'lib', 'brands.ts');
const SUPPORTED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
const DELAY_MS = 2000;

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

const deslugify = (slug: string): string => {
  // Read brands.ts and find matching brand name
  const brandsContent = execSync('cat src/lib/brands.ts', { encoding: 'utf-8' });

  // Extract all brand names from { name: 'Brand Name' } pattern
  const regex = /\{\s*name:\s*['"](.*?)['"]/g;
  const matches = [...brandsContent.matchAll(regex)];

  for (const match of matches) {
    const brandName = match[1];
    if (slugify(brandName) === slug) {
      return brandName;
    }
  }

  return slug;
};

const searchBrandDomain = async (brandName: string): Promise<string | null> => {
  // Check manual domains first
  if (MANUAL_DOMAINS[brandName]) {
    console.log(`  ✓ Found domain in manual mapping: ${MANUAL_DOMAINS[brandName]}`);
    return MANUAL_DOMAINS[brandName];
  }

  try {
    console.log(`  🔍 Searching for domain: ${brandName}`);

    const searchQuery = encodeURIComponent(`${brandName} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const firstResult = $('.result__url').first().text().trim();

    if (firstResult) {
      const urlObj = new URL(firstResult.startsWith('http') ? firstResult : `https://${firstResult}`);
      const domain = urlObj.hostname.replace(/^www\./, '');
      console.log(`  ✓ Found domain: ${domain}`);
      return domain;
    }
  } catch (error) {
    console.log(`  ⚠ Search failed for ${brandName}`);
  }

  return null;
};

const downloadHighQualityLogo = async (brandName: string, domain: string, slug: string): Promise<string | null> => {
  // Try scraping the website for logo first
  try {
    console.log(`  🌐 Scraping ${domain} for high-quality logo...`);
    const response = await axios.get(`https://${domain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      '.logo img',
      '#logo img',
      'header img[src*="logo"]',
      '.header img[src*="logo"]',
      '.navbar-brand img',
      'a[class*="logo" i] img',
      'svg.logo',
      '.site-logo img',
    ];

    for (const selector of logoSelectors) {
      const logoElement = $(selector).first();
      if (logoElement.length) {
        let logoUrl = logoElement.attr('src') || logoElement.attr('data-src');
        if (logoUrl) {
          if (logoUrl.startsWith('//')) {
            logoUrl = `https:${logoUrl}`;
          } else if (logoUrl.startsWith('/')) {
            logoUrl = `https://${domain}${logoUrl}`;
          } else if (!logoUrl.startsWith('http')) {
            logoUrl = `https://${domain}/${logoUrl}`;
          }

          // Skip favicons
          if (logoUrl.includes('favicon') || logoUrl.includes('16x16') || logoUrl.includes('32x32')) {
            continue;
          }

          const urlExtension = path.extname(new URL(logoUrl).pathname).toLowerCase();
          const extension = SUPPORTED_EXTENSIONS.includes(urlExtension) ? urlExtension : '.png';

          try {
            console.log(`  📥 Downloading from website: ${logoUrl.substring(0, 80)}...`);
            const logoResponse = await axios.get(logoUrl, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            const buffer = Buffer.from(logoResponse.data);

            if (buffer.length < 500) {
              console.log(`  ⚠ File too small (${buffer.length} bytes), skipping`);
              continue;
            }

            const fileName = `${slug}${extension}`;
            const filePath = path.join(LOGO_DIR, fileName);

            await fs.writeFile(filePath, buffer);
            console.log(`  ✅ Downloaded high-quality logo: ${fileName} (${buffer.length} bytes)`);

            return fileName;
          } catch (error) {
            console.log(`  ⚠ Failed to download from website`);
          }
        }
      }
    }
  } catch (error) {
    console.log(`  ⚠ Could not scrape website`);
  }

  // Fallback to API sources
  const sources = [
    {
      name: 'Clearbit (High-Res)',
      url: `https://logo.clearbit.com/${domain}`,
      extension: '.png',
    },
    {
      name: 'Logo.dev',
      url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=800`,
      extension: '.png',
    },
    {
      name: 'Icon Horse',
      url: `https://icon.horse/icon/${domain}`,
      extension: '.png',
    },
  ];

  for (const source of sources) {
    try {
      console.log(`  📥 Trying ${source.name}...`);

      const response = await axios.get(source.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        validateStatus: (status) => status === 200,
      });

      const buffer = Buffer.from(response.data);

      if (buffer.length < 500) {
        console.log(`  ⚠ ${source.name}: File too small, skipping`);
        continue;
      }

      const fileName = `${slug}${source.extension}`;
      const filePath = path.join(LOGO_DIR, fileName);

      await fs.writeFile(filePath, buffer);
      console.log(`  ✅ Downloaded from ${source.name}: ${fileName} (${buffer.length} bytes)`);

      return fileName;
    } catch (error) {
      console.log(`  ⚠ ${source.name}: Failed`);
    }
  }

  return null;
};

const main = async () => {
  try {
    console.log('🔄 Upgrading ALL small/low-quality logos...\n');

    // Load manual domains
    try {
      const raw = await fs.readFile(MANUAL_DOMAINS_PATH, 'utf-8');
      const data = JSON.parse(raw) as { domains: Record<string, string> };
      MANUAL_DOMAINS = data.domains;
      console.log(`📚 Loaded ${Object.keys(MANUAL_DOMAINS).length} manual domain mappings\n`);
    } catch (error) {
      console.log('⚠️  No manual domains file found\n');
    }

    // Find all small PNG files
    console.log('🔍 Scanning for small logos...\n');
    const files = await fs.readdir(LOGO_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));

    const smallLogos: BrandDomain[] = [];

    for (const file of pngFiles) {
      const filePath = path.join(LOGO_DIR, file);
      const stats = await fs.stat(filePath);

      // Check if file is smaller than 2KB (likely favicon)
      if (stats.size < 2048) {
        const slug = path.parse(file).name;
        const brandName = deslugify(slug);

        smallLogos.push({
          name: brandName,
          domain: '', // Will be filled later
          slug,
        });
      }
    }

    console.log(`📋 Found ${smallLogos.length} small logos to upgrade\n`);

    const stats = {
      total: smallLogos.length,
      upgraded: 0,
      failed: 0,
    };

    for (let i = 0; i < smallLogos.length; i++) {
      const brand = smallLogos[i];

      console.log(`\n[${i + 1}/${smallLogos.length}] Upgrading: ${brand.name} (${brand.slug})`);

      // Find domain
      const domain = await searchBrandDomain(brand.name);
      await delay(1000);

      if (!domain) {
        console.log(`  ✗ Could not find domain for ${brand.name}`);
        stats.failed++;
        continue;
      }

      brand.domain = domain;

      // Download high-quality logo
      const result = await downloadHighQualityLogo(brand.name, domain, brand.slug);

      if (result) {
        stats.upgraded++;
      } else {
        console.log(`  ✗ Failed to upgrade logo for ${brand.name}`);
        stats.failed++;
      }

      await delay(DELAY_MS);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL STATISTICS');
    console.log('='.repeat(50));
    console.log(`Total logos:  ${stats.total}`);
    console.log(`Upgraded:     ${stats.upgraded} ✅`);
    console.log(`Failed:       ${stats.failed} ❌`);
    console.log(`Success rate: ${(stats.upgraded / stats.total * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    console.log('\n⚠️  Now run: npm run download-logos-free');
    console.log('   to regenerate brandLogos.ts with upgraded logos');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

main();
