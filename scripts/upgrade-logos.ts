import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface BrandWithDomain {
  name: string;
  domain: string;
}

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const UPGRADE_LIST_PATH = path.join(process.cwd(), 'scripts', 'upgrade-small-logos.json');
const SUPPORTED_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
const DELAY_MS = 2000;

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

const downloadHighQualityLogo = async (brandName: string, domain: string, slug: string): Promise<string | null> => {
  // Try scraping the website for logo first (highest quality)
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

          // Skip very small images (favicons)
          if (logoUrl.includes('favicon') || logoUrl.includes('16x16') || logoUrl.includes('32x32')) {
            continue;
          }

          const urlExtension = path.extname(new URL(logoUrl).pathname).toLowerCase();
          const extension = SUPPORTED_EXTENSIONS.includes(urlExtension) ? urlExtension : '.png';

          try {
            console.log(`  📥 Downloading from website: ${logoUrl}`);
            const logoResponse = await axios.get(logoUrl, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            const buffer = Buffer.from(logoResponse.data);

            // Skip very small files (likely favicons)
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
    console.log('🔄 Upgrading small/low-quality logos...\n');

    const raw = await fs.readFile(UPGRADE_LIST_PATH, 'utf-8');
    const data = JSON.parse(raw) as { brands: BrandWithDomain[] };
    const brands = data.brands;

    console.log(`📋 Found ${brands.length} logos to upgrade\n`);

    const stats = {
      total: brands.length,
      upgraded: 0,
      failed: 0,
    };

    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const slug = slugify(brand.name);

      console.log(`\n[${i + 1}/${brands.length}] Upgrading: ${brand.name}`);

      const result = await downloadHighQualityLogo(brand.name, brand.domain, slug);

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
