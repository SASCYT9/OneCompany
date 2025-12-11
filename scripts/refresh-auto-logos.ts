/**
 * Refresh Auto Brand Logos Script
 * 
 * Downloads official SVG/PNG logos for automotive brands (excluding moto)
 * from their official websites. Prioritizes SVG, falls back to transparent PNG.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Import brand data
import { brandsUsa, brandsEurope, brandsOem, brandsRacing, brandsMoto, LocalBrand } from '../src/lib/brands';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
const DELAY_MS = 1500;
const TIMEOUT_MS = 15000;

// Moto brand names to exclude
const motoBrandNames = new Set(brandsMoto.map(b => b.name.toLowerCase()));

// All auto brands combined
const autoBrands: LocalBrand[] = [
  ...brandsUsa,
  ...brandsEurope,
  ...brandsOem,
  ...brandsRacing,
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
    return urlObj.hostname;
  } catch {
    return '';
  }
};

// Try to find SVG logo on the official website
const findSvgLogo = async (domain: string, brandName: string): Promise<Buffer | null> => {
  const baseUrl = `https://${domain}`;
  
  try {
    console.log(`  🔍 Searching for SVG on ${domain}...`);
    
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
      timeout: TIMEOUT_MS,
    });

    const $ = cheerio.load(response.data);
    
    // Common SVG logo locations
    const svgSelectors = [
      'img[src$=".svg"][alt*="logo" i]',
      'img[src$=".svg"][class*="logo" i]',
      'svg.logo',
      '.logo svg',
      'header svg',
      '.header svg',
      'a[class*="logo" i] svg',
      'img[src$=".svg"]',
      'object[data$=".svg"]',
    ];
    
    // Try to find inline SVG or SVG link
    for (const selector of svgSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // If it's an img tag with SVG src
        let svgUrl = element.attr('src') || element.attr('data');
        
        if (svgUrl && svgUrl.includes('.svg')) {
          // Normalize URL
          if (svgUrl.startsWith('//')) {
            svgUrl = `https:${svgUrl}`;
          } else if (svgUrl.startsWith('/')) {
            svgUrl = `${baseUrl}${svgUrl}`;
          } else if (!svgUrl.startsWith('http')) {
            svgUrl = `${baseUrl}/${svgUrl}`;
          }
          
          console.log(`  📥 Found SVG: ${svgUrl}`);
          
          const svgResponse = await axios.get(svgUrl, {
            responseType: 'arraybuffer',
            timeout: TIMEOUT_MS,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          const buffer = Buffer.from(svgResponse.data);
          if (buffer.length > 100 && buffer.toString('utf-8', 0, 100).includes('<svg')) {
            return buffer;
          }
        }
        
        // If it's an inline SVG element, extract it
        if (element.is('svg')) {
          const svgContent = $.html(element);
          if (svgContent && svgContent.length > 50) {
            console.log(`  📥 Found inline SVG`);
            return Buffer.from(svgContent, 'utf-8');
          }
        }
      }
    }
    
    // Try common SVG paths
    const commonPaths = [
      '/logo.svg',
      '/images/logo.svg',
      '/img/logo.svg',
      '/assets/logo.svg',
      '/assets/images/logo.svg',
      '/wp-content/themes/theme/images/logo.svg',
    ];
    
    for (const svgPath of commonPaths) {
      try {
        const svgUrl = `${baseUrl}${svgPath}`;
        const svgResponse = await axios.get(svgUrl, {
          responseType: 'arraybuffer',
          timeout: 5000,
          validateStatus: (status) => status === 200,
        });
        
        const buffer = Buffer.from(svgResponse.data);
        if (buffer.length > 100 && buffer.toString('utf-8', 0, 100).includes('<svg')) {
          console.log(`  📥 Found SVG at ${svgPath}`);
          return buffer;
        }
      } catch {
        // Continue trying other paths
      }
    }
    
  } catch (error) {
    console.log(`  ⚠️ Could not scrape ${domain}`);
  }
  
  return null;
};

// Download PNG logo with transparent background
const downloadPngLogo = async (domain: string, brandName: string): Promise<{ buffer: Buffer; extension: string } | null> => {
  const sources = [
    {
      name: 'Logo.dev PNG',
      url: `https://img.logo.dev/${domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=400`,
    },
    {
      name: 'Clearbit',
      url: `https://logo.clearbit.com/${domain}`,
    },
    {
      name: 'Google S2',
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    },
  ];
  
  for (const source of sources) {
    try {
      console.log(`  📥 Trying ${source.name}...`);
      
      const response = await axios.get(source.url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        validateStatus: (status) => status === 200,
      });
      
      const buffer = Buffer.from(response.data);
      
      if (buffer.length > 500) {
        console.log(`  ✅ Downloaded from ${source.name}`);
        return { buffer, extension: '.png' };
      }
    } catch {
      console.log(`  ⚠️ ${source.name} failed`);
    }
  }
  
  return null;
};

// Process a single brand
const processBrand = async (brand: LocalBrand, slug: string): Promise<{ path: string; extension: string } | null> => {
  if (!brand.website) {
    console.log(`  ⚠️ No website defined`);
    return null;
  }
  
  const domain = extractDomain(brand.website);
  if (!domain) {
    console.log(`  ⚠️ Invalid website URL`);
    return null;
  }
  
  // First try to get SVG
  const svgBuffer = await findSvgLogo(domain, brand.name);
  if (svgBuffer) {
    const fileName = `${slug}.svg`;
    const filePath = path.join(LOGO_DIR, fileName);
    await fs.writeFile(filePath, svgBuffer);
    console.log(`  ✅ Saved SVG: ${fileName}`);
    return { path: `/logos/${fileName}`, extension: '.svg' };
  }
  
  // Fall back to PNG
  const pngResult = await downloadPngLogo(domain, brand.name);
  if (pngResult) {
    const fileName = `${slug}${pngResult.extension}`;
    const filePath = path.join(LOGO_DIR, fileName);
    await fs.writeFile(filePath, pngResult.buffer);
    console.log(`  ✅ Saved PNG: ${fileName}`);
    return { path: `/logos/${fileName}`, extension: pngResult.extension };
  }
  
  return null;
};

// Generate brandLogos.ts file
const generateBrandLogosFile = async (logoMap: Record<string, string>, motoLogos: Record<string, string>) => {
  // Merge auto logos with preserved moto logos
  const mergedMap = { ...logoMap, ...motoLogos };
  
  let fileContent = `// This file is auto-generated by scripts/refresh-auto-logos.ts\n`;
  fileContent += `// Moto logos are preserved, auto logos are refreshed from official sources\n\n`;
  fileContent += `export const BRAND_LOGO_MAP: Record<string, string> = {\n`;

  for (const [brandName, logoPath] of Object.entries(mergedMap).sort((a, b) => a[0].localeCompare(b[0]))) {
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
};

// Read existing moto logos to preserve
const readExistingMotoLogos = async (): Promise<Record<string, string>> => {
  try {
    const content = await fs.readFile(BRAND_LOGOS_PATH, 'utf-8');
    const motoLogos: Record<string, string> = {};
    
    // Extract existing entries
    const regex = /'([^']+)':\s*'([^']+)'/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const brandName = match[1];
      const logoPath = match[2];
      
      // Keep only moto brand logos
      if (motoBrandNames.has(brandName.toLowerCase())) {
        motoLogos[brandName] = logoPath;
      }
    }
    
    console.log(`📋 Preserved ${Object.keys(motoLogos).length} moto logos`);
    return motoLogos;
  } catch {
    return {};
  }
};

// Main function
const main = async () => {
  console.log('🚀 Starting Auto Brand Logo Refresh...\n');
  console.log(`📁 Logo directory: ${LOGO_DIR}`);
  console.log(`📋 Auto brands to process: ${autoBrands.length}`);
  console.log(`🏍️ Moto brands to preserve: ${motoBrandNames.size}\n`);
  
  // Ensure logo directory exists
  await fs.mkdir(LOGO_DIR, { recursive: true });
  
  // Read existing moto logos to preserve them
  const motoLogos = await readExistingMotoLogos();
  
  const logoMap: Record<string, string> = {};
  const stats = {
    total: autoBrands.length,
    svg: 0,
    png: 0,
    failed: 0,
    skipped: 0,
  };
  
  for (let i = 0; i < autoBrands.length; i++) {
    const brand = autoBrands[i];
    const slug = slugify(brand.name);
    
    console.log(`\n[${i + 1}/${autoBrands.length}] ${brand.name}`);
    
    // Skip if it's actually a moto brand (in case of overlap)
    if (motoBrandNames.has(brand.name.toLowerCase())) {
      console.log(`  ⏭️ Skipping (moto brand)`);
      stats.skipped++;
      continue;
    }
    
    const result = await processBrand(brand, slug);
    
    if (result) {
      logoMap[brand.name] = result.path;
      if (result.extension === '.svg') {
        stats.svg++;
      } else {
        stats.png++;
      }
    } else {
      stats.failed++;
      // Keep existing logo if download failed
      const existingPath = `/logos/${slug}.png`;
      logoMap[brand.name] = existingPath;
    }
    
    await delay(DELAY_MS);
  }
  
  // Generate new brandLogos.ts
  console.log('\n📝 Generating brandLogos.ts...');
  await generateBrandLogosFile(logoMap, motoLogos);
  
  // Print statistics
  console.log('\n' + '='.repeat(50));
  console.log('📊 STATISTICS');
  console.log('='.repeat(50));
  console.log(`Total auto brands:  ${stats.total}`);
  console.log(`SVG downloaded:     ${stats.svg} ✅`);
  console.log(`PNG downloaded:     ${stats.png} 📷`);
  console.log(`Failed:             ${stats.failed} ❌`);
  console.log(`Skipped (moto):     ${stats.skipped} ⏭️`);
  console.log(`Moto preserved:     ${Object.keys(motoLogos).length} 🏍️`);
  console.log('='.repeat(50));
  console.log(`\n✨ Done! brandLogos.ts updated.`);
};

main().catch(console.error);
