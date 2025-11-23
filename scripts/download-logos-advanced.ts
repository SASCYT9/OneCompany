import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration
const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRANDS_LIST_PATH = path.join(process.cwd(), 'scripts', 'brands-list.json');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Types
interface BrandWithCategory {
  name: string;
  category: string;
}

interface LogoResult {
  url: string;
  source: string;
  extension: string;
  score: number; // Higher is better (SVG = 100, High-Res PNG = 50, etc.)
}

// Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getSearchContext = (category: string): string => {
  const cat = category.toUpperCase();
  if (cat === 'MOTO') return 'motorcycle parts performance';
  if (cat === 'RACING') return 'motorsport racing parts';
  if (cat === 'OEM') return 'car manufacturer';
  return 'automotive tuning performance parts'; // Default for USA/EUROPE
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

// --- Providers ---

// 1. WorldVectorLogo (Best for SVGs)
const searchWorldVectorLogo = async (brandName: string): Promise<LogoResult | null> => {
  try {
    const searchUrl = `https://worldvectorlogo.com/search/${encodeURIComponent(brandName)}`;
    const response = await axios.get(searchUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
    const $ = cheerio.load(response.data);
    
    const firstLogoLink = $('.logo__img').first().attr('src');
    if (firstLogoLink) {
      return {
        url: firstLogoLink,
        source: 'WorldVectorLogo',
        extension: '.svg',
        score: 100
      };
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
};

// 2. Wikipedia (Good for official SVGs)
const searchWikipedia = async (brandName: string, context: string): Promise<LogoResult | null> => {
  try {
    // Search for the page with context to avoid ambiguity (e.g. "Arrow" vs "Arrow Exhaust")
    const searchQuery = `${brandName} ${context}`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    
    // If no results with context, try just the name but be careful
    let pageTitle = searchRes.data.query.search[0]?.title;
    
    if (!pageTitle) {
       const fallbackUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(brandName)}&format=json`;
       const fallbackRes = await axios.get(fallbackUrl, { timeout: 5000 });
       pageTitle = fallbackRes.data.query.search[0]?.title;
    }

    if (!pageTitle) return null;

    // Get page info to find main image
    const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&format=json&pithumbsize=1000`;
    const pageRes = await axios.get(pageUrl, { timeout: 5000 });
    const pages = pageRes.data.query.pages;
    const pageId = Object.keys(pages)[0];
    const imageUrl = pages[pageId]?.thumbnail?.source;

    if (imageUrl) {
      const ext = path.extname(imageUrl).toLowerCase();
      if (ext === '.svg') {
        return { url: imageUrl, source: 'Wikipedia', extension: '.svg', score: 95 };
      } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        // Check if original is SVG (Wikipedia often converts to PNG for thumbnail)
        // But here we just take what we get for now, or try to find the original file page.
        // For simplicity, if it's high res PNG, it's good.
        return { url: imageUrl, source: 'Wikipedia', extension: ext, score: 80 };
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
};

// 3. DuckDuckGo HTML (General search for domain -> then scrape)
const getBrandDomain = async (brandName: string, context: string): Promise<string | null> => {
  try {
    const query = `${brandName} ${context} official website`;
    const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    const firstLink = $('.result__url').first().text().trim();
    if (firstLink) {
      try {
        const url = new URL(firstLink.startsWith('http') ? firstLink : `https://${firstLink}`);
        return url.hostname;
      } catch {
        return null;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
};

// 4. Website Scraper (Enhanced)
const scrapeWebsite = async (domain: string): Promise<LogoResult | null> => {
  try {
    const url = `https://${domain}`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 });
    const $ = cheerio.load(response.data);

    // Priority 1: SVG in img src
    let bestLogo: LogoResult | null = null;

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt')?.toLowerCase() || '';
      const className = $(el).attr('class')?.toLowerCase() || '';
      const id = $(el).attr('id')?.toLowerCase() || '';
      
      if (!src) return;

      const isLogo = alt.includes('logo') || className.includes('logo') || id.includes('logo');
      const isSvg = src.toLowerCase().endsWith('.svg');

      if (isLogo && isSvg) {
        bestLogo = { url: new URL(src, url).href, source: 'Website (SVG)', extension: '.svg', score: 90 };
        return false; // Break loop
      }
    });

    if (bestLogo) return bestLogo;

    // Priority 2: Open Graph Image (High Quality PNG/JPG)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const ext = path.extname(new URL(ogImage, url).pathname).toLowerCase() || '.png';
      return { url: new URL(ogImage, url).href, source: 'Website (OG)', extension: ext, score: 60 };
    }

    // Priority 3: Icon
    const icon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
    if (icon) {
       const ext = path.extname(new URL(icon, url).pathname).toLowerCase();
       if (ext === '.svg') {
         return { url: new URL(icon, url).href, source: 'Website (Favicon SVG)', extension: '.svg', score: 85 };
       }
    }

  } catch (e) {
    // Ignore
  }
  return null;
};

// 5. Clearbit (Fallback)
const checkClearbit = async (domain: string): Promise<LogoResult | null> => {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    // Just check if it exists
    await axios.head(url, { timeout: 3000 });
    return { url, source: 'Clearbit', extension: '.png', score: 40 };
  } catch {
    return null;
  }
};

// --- Main Logic ---

const downloadFile = async (url: string, destPath: string): Promise<boolean> => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });
    await fs.writeFile(destPath, response.data);
    return true;
  } catch (e) {
    return false;
  }
};

const processBrand = async (brand: BrandWithCategory) => {
  const slug = slugify(brand.name);
  const context = getSearchContext(brand.category);
  console.log(`\n🔍 Processing: ${brand.name} [${context}]`);

  // 1. Try WorldVectorLogo (Best for SVG)
  let result = await searchWorldVectorLogo(brand.name);
  if (result) console.log(`  ✓ Found on WorldVectorLogo`);

  // 2. Try Wikipedia if no SVG yet
  if (!result || result.extension !== '.svg') {
    const wikiResult = await searchWikipedia(brand.name, context);
    if (wikiResult && (!result || wikiResult.score > result.score)) {
      result = wikiResult;
      console.log(`  ✓ Found on Wikipedia`);
    }
  }

  // 3. Try Website if no SVG yet
  if (!result || result.extension !== '.svg') {
    const domain = await getBrandDomain(brand.name, context);
    if (domain) {
      console.log(`  ✓ Domain found: ${domain}`);
      const webResult = await scrapeWebsite(domain);
      if (webResult && (!result || webResult.score > result.score)) {
        result = webResult;
        console.log(`  ✓ Found on Website`);
      }
      
      // 4. Try Clearbit as last resort
      if (!result) {
        const clearbitResult = await checkClearbit(domain);
        if (clearbitResult) {
          result = clearbitResult;
          console.log(`  ✓ Found on Clearbit`);
        }
      }
    }
  }

  if (result) {
    const fileName = `${slug}${result.extension}`;
    const destPath = path.join(LOGO_DIR, fileName);
    const success = await downloadFile(result.url, destPath);
    if (success) {
      console.log(`  ✅ Downloaded ${result.extension} from ${result.source}`);
      return fileName;
    } else {
      console.log(`  ❌ Failed to download from ${result.url}`);
    }
  } else {
    console.log(`  ⚠️ No logo found`);
  }
  return null;
};

const main = async () => {
  console.log('🚀 Starting Advanced Logo Parser...');
  
  // Ensure dir exists
  await fs.mkdir(LOGO_DIR, { recursive: true });

  // Read brands
  const raw = await fs.readFile(BRANDS_LIST_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const brands: BrandWithCategory[] = [];
  for (const [cat, names] of Object.entries(data.categories)) {
    (names as string[]).forEach(name => brands.push({ name, category: cat }));
  }

  console.log(`📋 Loaded ${brands.length} brands.`);

  const logoMap: Record<string, string> = {};

  // Process in chunks to be nice to APIs
  const CHUNK_SIZE = 5;
  for (let i = 0; i < brands.length; i += CHUNK_SIZE) {
    const chunk = brands.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (brand) => {
      const fileName = await processBrand(brand);
      if (fileName) {
        logoMap[brand.name] = `/logos/${fileName}`;
      }
    }));
    await delay(1000); // Wait between chunks
  }

  // Generate Map File
  let fileContent = `// Auto-generated by scripts/download-logos-advanced.ts\n\n`;
  fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;
  Object.entries(logoMap).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, path]) => {
    fileContent += `  '${name.replace(/'/g, "\\'")}': '${path}',\n`;
  });
  fileContent += `};\n\n`;
  fileContent += `const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(\n`;
  fileContent += `  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])\n`;
  fileContent += `);\n\n`;
  fileContent += `export const getBrandLogo = (brandName: string): string => {\n`;
  fileContent += `  if (!brandName) return '/logos/placeholder.svg';\n`;
  fileContent += `  const normalizedName = brandName.trim().toLowerCase();\n`;
  fileContent += `  return BRAND_LOGO_MAP[brandName] || NORMALIZED_BRAND_LOGO_MAP[normalizedName] || '/logos/placeholder.svg';\n`;
  fileContent += `};\n`;

  await fs.writeFile(BRAND_LOGOS_PATH, fileContent);
  console.log(`\n✨ Done! Map saved to ${BRAND_LOGOS_PATH}`);
};

main();
