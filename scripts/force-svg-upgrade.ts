import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import sizeOf from 'image-size';

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
const CONCURRENCY_LIMIT = 15;

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
    const searchQuery = encodeURIComponent(`${brandName} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
    });

    const $ = cheerio.load(response.data);
    const firstResult = $('.result__url').first().text().trim();

    if (firstResult) {
      return extractDomain(firstResult);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Check if SVG logo exists
const findExistingSVG = async (slug: string): Promise<string | null> => {
  const candidate = `${slug}.svg`;
  try {
    await fs.access(path.join(LOGO_DIR, candidate));
    return candidate;
  } catch {
    return null;
  }
};

// Helper to validate image buffer
const validateImage = (buffer: Buffer, type: 'svg' | 'png'): boolean => {
    if (buffer.length < 500) return false; // Too small
    
    if (type === 'png') {
        try {
            const dimensions = sizeOf(buffer);
            // Require at least 300px width or height for "High Quality"
            if (dimensions.width && dimensions.width < 300 && dimensions.height && dimensions.height < 300) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    return true;
};

// Try to download logo (SVG priority, then HQ PNG)
const downloadBestLogo = async (brandName: string, domain: string, slug: string): Promise<string | null> => {
  
  // --- STRATEGY 1: SVG SOURCES ---

  // 1.1 Wikimedia Commons (High quality, reliable)
  try {
      const wikiFilename = `${brandName.replace(/\s+/g, '_')}_logo.svg`;
      const wikiUrl = `https://commons.wikimedia.org/wiki/File:${wikiFilename}`;
      const wikiRes = await axios.get(wikiUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' },
          validateStatus: (status) => status === 200 || status === 404 
      });
      
      if (wikiRes.status === 200) {
          const $wiki = cheerio.load(wikiRes.data);
          const downloadUrl = $wiki('.fullMedia a').attr('href');
          if (downloadUrl) {
              const svgRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
              if (validateImage(svgRes.data, 'svg')) {
                const fileName = `${slug}.svg`;
                await fs.writeFile(path.join(LOGO_DIR, fileName), svgRes.data);
                return fileName;
              }
          }
      }
  } catch (e) { }

  // 1.2 WorldVectorLogo (Best source for SVGs)
  try {
    const searchUrl = `https://worldvectorlogo.com/search/${encodeURIComponent(brandName)}`;
    const searchRes = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
    });
    
    const $search = cheerio.load(searchRes.data);
    const firstLogoLink = $search('.logos .logo a').first().attr('href');

    if (firstLogoLink) {
        const detailRes = await axios.get(firstLogoLink, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        const $detail = cheerio.load(detailRes.data);
        const downloadUrl = $detail('.button--download').attr('href');

        if (downloadUrl) {
            const svgRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                headers: { 
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': firstLogoLink
                },
                timeout: 5000
            });
            
            if (validateImage(svgRes.data, 'svg')) {
                const fileName = `${slug}.svg`;
                await fs.writeFile(path.join(LOGO_DIR, fileName), svgRes.data);
                return fileName;
            }
        }
    }
  } catch (e) { }

  // 1.3 Official Website Scraping for SVG
  try {
    const response = await axios.get(`https://${domain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(response.data);
    const logoSelectors = [
      'img[src$=".svg"]',
      'img[src*="logo"][src$=".svg"]',
      'a[class*="logo"] img[src$=".svg"]',
      'header img[src$=".svg"]',
      'object[type="image/svg+xml"]',
      'embed[type="image/svg+xml"]'
    ];

    for (const selector of logoSelectors) {
      const logoElement = $(selector).first();
      if (logoElement.length) {
        let logoUrl = logoElement.attr('src') || logoElement.attr('data-src');
        if (logoUrl) {
          if (logoUrl.startsWith('//')) logoUrl = `https:${logoUrl}`;
          else if (logoUrl.startsWith('/')) logoUrl = `https://${domain}${logoUrl}`;
          else if (!logoUrl.startsWith('http')) logoUrl = `https://${domain}/${logoUrl}`;
          
          const logoResponse = await axios.get(logoUrl, {
              responseType: 'arraybuffer',
              timeout: 5000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          if (validateImage(logoResponse.data, 'svg')) {
            const fileName = `${slug}.svg`;
            await fs.writeFile(path.join(LOGO_DIR, fileName), logoResponse.data);
            return fileName;
          }
        }
      }
    }
  } catch (error) { }

  // --- STRATEGY 2: HIGH-QUALITY PNG SOURCES ---

  // 2.1 Logo.dev (Reliable API, often has transparent PNGs)
  try {
      // Request a larger size (e.g., 500px)
      const logoDevUrl = `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=500`;
      const response = await axios.get(logoDevUrl, {
          responseType: 'arraybuffer',
          timeout: 5000,
          validateStatus: (status) => status === 200
      });

      if (validateImage(response.data, 'png')) {
          const fileName = `${slug}.png`;
          await fs.writeFile(path.join(LOGO_DIR, fileName), response.data);
          return fileName;
      }
  } catch (e) { }

  // 2.2 Official Website Scraping for Large PNG/WebP
  try {
    const response = await axios.get(`https://${domain}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000,
    });
    const $ = cheerio.load(response.data);
    
    const pngSelectors = [
        'img[src*="logo"][src$=".png"]',
        'img[class*="logo"][src$=".png"]',
        'header img[src$=".png"]',
        'img[src*="logo"][src$=".webp"]'
    ];

    for (const selector of pngSelectors) {
        const el = $(selector).first();
        if (el.length) {
            let src = el.attr('src');
            if (src) {
                if (src.startsWith('//')) src = `https:${src}`;
                else if (src.startsWith('/')) src = `https://${domain}${src}`;
                else if (!src.startsWith('http')) src = `https://${domain}/${src}`;

                const imgRes = await axios.get(src, { responseType: 'arraybuffer', timeout: 5000 });
                if (validateImage(imgRes.data, 'png')) {
                    const ext = path.extname(src) || '.png';
                    const fileName = `${slug}${ext}`;
                    await fs.writeFile(path.join(LOGO_DIR, fileName), imgRes.data);
                    return fileName;
                }
            }
        }
    }
  } catch (e) { }

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

// Helper to find any logo for fallback
const findExistingAnyLogo = async (slug: string): Promise<string | null> => {
    const extensions = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
    for (const extension of extensions) {
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

// Main function
const main = async () => {
  try {
    console.log('🚀 Starting Logo Upgrade Process (SVG Priority + HQ PNG Fallback)...\n');

    // Create logo directory
    await fs.mkdir(LOGO_DIR, { recursive: true });

    // Read brands list
    const brands = await readBrandsList();
    console.log(`📋 Found ${brands.length} brands to process\n`);

    const logoMap: Record<string, string> = {};
    const stats = {
      total: brands.length,
      upgraded: 0,
      alreadySvg: 0,
      failed: 0,
    };

    const limit = pLimit(CONCURRENCY_LIMIT);

    const tasks = brands.map((brand, index) => {
        return limit(async () => {
            const brandName = brand.name;
            const slug = slugify(brandName);

            // Check if SVG already exists
            const existingSVG = await findExistingSVG(slug);
            if (existingSVG) {
                logoMap[brandName] = `/logos/${existingSVG}`;
                stats.alreadySvg++;
                process.stdout.write('.'); // Progress indicator
                return;
            }

            // Search for domain
            const domain = await searchBrandDomain(brandName);

            if (!domain) {
                stats.failed++;
                process.stdout.write('x');
                return;
            }

            // Download Best Logo
            const fileName = await downloadBestLogo(brandName, domain, slug);

            if (fileName) {
                logoMap[brandName] = `/logos/${fileName}`;
                stats.upgraded++;
                process.stdout.write('✓');
            } else {
                stats.failed++;
                process.stdout.write('x');
                
                // Fallback to existing non-SVG if available (for the map)
                const anyLogo = await findExistingAnyLogo(slug);
                if (anyLogo) {
                    logoMap[brandName] = `/logos/${anyLogo}`;
                }
            }
        });
    });

    await Promise.all(tasks);

    console.log('\n\n📝 Generating brandLogos.ts file...');

    let fileContent = `// This file is auto-generated by scripts/force-svg-upgrade.ts\n\n`;
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
    console.log(`Upgraded (SVG/HQ): ${stats.upgraded} ✨`);
    console.log(`Already SVG:       ${stats.alreadySvg} ✅`);
    console.log(`Failed:            ${stats.failed} ❌`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

main();
