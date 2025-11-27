/**
 * Premium Logo Fetcher - Downloads highest quality logos (SVG preferred)
 * 
 * Priority: SVG > WebP > PNG (transparent)
 * Sources: Brandfetch API, SimpleIcons, WorldVectorLogo, Clearbit
 * 
 * Run: npx tsx scripts/fetch-premium-logos.ts
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRANDS_LIST_PATH = path.join(process.cwd(), 'scripts', 'brands-list.json');

// Brand domains for API lookups
const BRAND_DOMAINS: Record<string, string> = {
  // Top automotive brands
  'Akrapovic': 'akrapovic.com',
  'Eventuri': 'eventuri.net',
  'KW': 'kwsuspensions.com',
  'HRE': 'hrewheels.com',
  'Brembo': 'brembo.com',
  'Vorsteiner': 'vorsteiner.com',
  'Armytrix': 'armytrix.com',
  'CSF': 'csfrace.com',
  'Manhart': 'manhart-performance.de',
  'Renntech': 'renntechmercedes.com',
  'Velos Wheels': 'velosdesignwerks.com',
  'Weistec': 'weistec.com',
  'Novitec': 'novitecgroup.com',
  'Brabus': 'brabus.com',
  'ABT': 'abt-sportsline.com',
  'Techart': 'techart.de',
  'IPE': 'ipe-exhaust.com',
  'AWE': 'awe-tuning.com',
  'H&R': 'h-r.com',
  'Eibach': 'eibach.com',
  'BBS': 'bbs.com',
  'OZ Racing': 'ozracing.com',
  'Bilstein': 'bilstein.com',
  'Ohlins': 'ohlins.com',
  'Capristo': 'capristo.de',
  'Fi Exhaust': 'fi-exhaust.com',
  'AC Schnitzer': 'ac-schnitzer.de',
  'Hamann': 'hamann-motorsport.de',
  'Lorinser': 'lorinser.com',
  'Carlsson': 'carlsson.de',
  'Mansory': 'mansory.com',
  'Liberty Walk': 'libertywalk.co.jp',
  'RWB': 'rauhwelt.com',
  'Rocket Bunny': 'rocket-bunny.com',
  'Bagged': 'bagged.com',
  'Air Lift': 'airliftperformance.com',
  'StopTech': 'stoptech.com',
  'AP Racing': 'apracing.com',
  'Alcon': 'alcon.co.uk',
  'Endless': 'endless-sport.co.jp',
  'Project Mu': 'projectmu.co.jp',
  'Rays': 'rayswheels.co.jp',
  'Work Wheels': 'work-wheels.co.jp',
  'Vossen': 'vfrwheels.com',
  'Forgiato': 'forgiato.com',
  'ADV.1': 'thewheelindustry.com',
  'Rotiform': 'rotiform.com',
  'fifteen52': 'fifteen52.com',
  'Method Race': 'methodracewheels.com',
  'Borla': 'borla.com',
  'MagnaFlow': 'magnaflow.com',
  'Flowmaster': 'flowmastermufflers.com',
  'Milltek': 'millteksport.com',
  'Remus': 'remus.eu',
  'Supersprint': 'supersprint.com',
  'APR': 'goapr.com',
  'COBB': 'cobbtuning.com',
  'Unitronic': 'getunitronic.com',
  'Dinan': 'dinancars.com',
  'Alpha-N': 'alpha-n.de',
  'G-Power': 'g-power.de',
  'Hennessey': 'hennesseyperformance.com',
  'Lingenfelter': 'lingenfelter.com',
  'Roush': 'roush.com',
  'Shelby': 'shelby.com',
  'Saleen': 'saleen.com',
  '3D Design': '3ddesign.co.jp',
  'Sterckenn': 'sterckenn.com',
  'RKP': 'rkpcomposites.com',
  'Seibon': 'seibon.com',
  'Karbel': 'karbelcarbon.com',
  'Darwinpro': 'darwinproaero.com',
  'Titan Motorsports': 'titanmotorsports.com',
  'SC Project': 'sc-project.com',
  'Termignoni': 'termignoni.it',
  'Arrow': 'arrow.it',
  'LeoVince': 'leovince.com',
  'Yoshimura': 'yoshimura-jp.com',
  'Two Brothers': 'twobros.com',
  'Rotobox': 'rotobox.eu',
  'BST': 'blackstonetek.com',
  'Dymag': 'dymag.com',
  'Marchesini': 'marchesini.com',
  'Bonamici': 'bonamiciracing.it',
  'Woodcraft': 'woodcraft-cfm.com',
  'Gilles Tooling': 'gillestooling.com',
  'CNC Racing': 'cncracing.it',
  'Rizoma': 'rizoma.com',
  'Lightech': 'lightech.it',
  'Puig': 'puig.tv',
  'Zero Gravity': 'zerogravity-racing.com',
};

interface LogoSource {
  name: string;
  getUrl: (brand: string, domain: string, slug: string) => string;
  format: 'svg' | 'png' | 'webp' | 'ico';
  priority: number;
}

const LOGO_SOURCES: LogoSource[] = [
  // SVG Sources (highest priority)
  {
    name: 'SimpleIcons',
    getUrl: (_, __, slug) => `https://cdn.simpleicons.org/${slug.replace(/-/g, '')}`,
    format: 'svg',
    priority: 1,
  },
  {
    name: 'SVGPorn',
    getUrl: (_, __, slug) => `https://cdn.svgporn.com/logos/${slug}.svg`,
    format: 'svg',
    priority: 2,
  },
  {
    name: 'VectorLogoZone',
    getUrl: (_, __, slug) => `https://www.vectorlogo.zone/logos/${slug}/${slug}-icon.svg`,
    format: 'svg',
    priority: 3,
  },
  // PNG/WebP Sources (high quality, transparent)
  {
    name: 'Brandfetch',
    getUrl: (_, domain) => `https://cdn.brandfetch.io/${domain}/w/512/h/512/logo`,
    format: 'png',
    priority: 4,
  },
  {
    name: 'Clearbit HD',
    getUrl: (_, domain) => `https://logo.clearbit.com/${domain}?size=512`,
    format: 'png',
    priority: 5,
  },
  {
    name: 'Clearbit',
    getUrl: (_, domain) => `https://logo.clearbit.com/${domain}`,
    format: 'png',
    priority: 6,
  },
  {
    name: 'Google Favicon',
    getUrl: (_, domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    format: 'png',
    priority: 7,
  },
];

// Slugify brand name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Fetch with timeout and redirect handling
function fetchUrl(url: string, timeout = 10000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/svg+xml,image/webp,image/png,image/*,*/*',
      },
      timeout,
    }, (response) => {
      // Follow redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchUrl(response.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Validate image content
function isValidImage(buffer: Buffer, expectedFormat: string): boolean {
  if (buffer.length < 100) return false;
  
  const header = buffer.slice(0, 20).toString('utf8');
  
  if (expectedFormat === 'svg') {
    return header.includes('<svg') || header.includes('<?xml');
  }
  
  // PNG magic bytes
  if (expectedFormat === 'png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  
  // WebP magic bytes
  if (expectedFormat === 'webp') {
    return buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
  }
  
  return buffer.length > 500; // Fallback: at least 500 bytes
}

// Check if logo exists
async function logoExists(slug: string): Promise<string | null> {
  const extensions = ['.svg', '.webp', '.png'];
  for (const ext of extensions) {
    try {
      await fs.access(path.join(LOGO_DIR, `${slug}${ext}`));
      return ext;
    } catch { /* continue */ }
  }
  return null;
}

// Download logo from multiple sources
async function downloadLogo(brand: string): Promise<{ file: string; source: string; format: string } | null> {
  const slug = slugify(brand);
  const domain = BRAND_DOMAINS[brand] || `${slug}.com`;
  
  // Sort by priority
  const sortedSources = [...LOGO_SOURCES].sort((a, b) => a.priority - b.priority);
  
  for (const source of sortedSources) {
    try {
      const url = source.getUrl(brand, domain, slug);
      console.log(`    📥 ${source.name} (${source.format.toUpperCase()})...`);
      
      const buffer = await fetchUrl(url);
      
      if (!isValidImage(buffer, source.format)) {
        console.log(`    ⚠️  Invalid ${source.format.toUpperCase()}`);
        continue;
      }
      
      const ext = source.format === 'svg' ? '.svg' : 
                  source.format === 'webp' ? '.webp' : '.png';
      const fileName = `${slug}${ext}`;
      const filePath = path.join(LOGO_DIR, fileName);
      
      await fs.writeFile(filePath, buffer);
      
      const sizeKB = (buffer.length / 1024).toFixed(1);
      console.log(`    ✅ ${fileName} (${sizeKB} KB)`);
      
      return { file: fileName, source: source.name, format: source.format };
    } catch (error) {
      // Silently continue to next source
    }
  }
  
  return null;
}

// Read brands list
async function readBrandsList(): Promise<string[]> {
  try {
    const raw = await fs.readFile(BRANDS_LIST_PATH, 'utf-8');
    const data = JSON.parse(raw) as { categories: Record<string, string[]> };
    
    const brands: string[] = [];
    for (const categoryBrands of Object.values(data.categories)) {
      brands.push(...categoryBrands);
    }
    return [...new Set(brands)]; // Dedupe
  } catch {
    // Return top brands if file not found
    return Object.keys(BRAND_DOMAINS);
  }
}

// Update brandLogos.ts
async function updateBrandLogosTs(results: Map<string, string>): Promise<void> {
  const brandLogosPath = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
  let content = await fs.readFile(brandLogosPath, 'utf-8');
  
  for (const [brandName, fileName] of results) {
    const logoPath = `/logos/${fileName}`;
    const escapedBrand = brandName.replace(/'/g, "\\'");
    
    // Check if brand exists
    const pattern = new RegExp(`['"]${escapedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]:\\s*['"][^'"]*['"]`, 'i');
    
    if (pattern.test(content)) {
      content = content.replace(pattern, `'${escapedBrand}': '${logoPath}'`);
    } else {
      // Add new entry
      const insertPoint = content.indexOf('= {') + 3;
      content = content.slice(0, insertPoint) + `\n  '${escapedBrand}': '${logoPath}',` + content.slice(insertPoint);
    }
  }
  
  await fs.writeFile(brandLogosPath, content, 'utf-8');
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🏆 PREMIUM LOGO FETCHER                           ║
║         Priority: SVG → WebP → PNG (transparent)          ║
╚═══════════════════════════════════════════════════════════╝
`);

  await fs.mkdir(LOGO_DIR, { recursive: true });
  
  const brands = await readBrandsList();
  console.log(`📋 Found ${brands.length} brands to process\n`);
  
  const results = new Map<string, string>();
  const stats = {
    svg: 0,
    webp: 0,
    png: 0,
    skipped: 0,
    failed: 0,
  };
  
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    const slug = slugify(brand);
    
    console.log(`[${i + 1}/${brands.length}] ${brand}`);
    
    // Check if SVG already exists (skip if so)
    const existing = await logoExists(slug);
    if (existing === '.svg') {
      console.log(`    ♻️  SVG exists, skipping`);
      stats.skipped++;
      continue;
    }
    
    const result = await downloadLogo(brand);
    
    if (result) {
      results.set(brand, result.file);
      if (result.format === 'svg') stats.svg++;
      else if (result.format === 'webp') stats.webp++;
      else stats.png++;
    } else {
      console.log(`    ❌ No logo found`);
      stats.failed++;
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Update brandLogos.ts
  if (results.size > 0) {
    console.log('\n📝 Updating brandLogos.ts...');
    await updateBrandLogosTs(results);
  }
  
  // Summary
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    📊 RESULTS                             ║
╠═══════════════════════════════════════════════════════════╣
║  SVG downloaded:    ${String(stats.svg).padStart(4)}                                ║
║  WebP downloaded:   ${String(stats.webp).padStart(4)}                                ║
║  PNG downloaded:    ${String(stats.png).padStart(4)}                                ║
║  Skipped (exists):  ${String(stats.skipped).padStart(4)}                                ║
║  Failed:            ${String(stats.failed).padStart(4)}                                ║
╠═══════════════════════════════════════════════════════════╣
║  Total processed:   ${String(brands.length).padStart(4)}                                ║
╚═══════════════════════════════════════════════════════════╝
`);
}

main().catch(console.error);
