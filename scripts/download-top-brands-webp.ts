/**
 * Download high-quality WebP logos for TOP automotive brands
 * Run: npx tsx scripts/download-top-brands-webp.ts
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');

// Top brands with their official domains
const TOP_BRANDS: { name: string; slug: string; domain: string }[] = [
  { name: 'Akrapovic', slug: 'akrapovic', domain: 'akrapovic.com' },
  { name: 'Eventuri', slug: 'eventuri', domain: 'eventuri.net' },
  { name: 'KW', slug: 'kw', domain: 'kwsuspensions.com' },
  { name: 'HRE', slug: 'hre', domain: 'hrewheels.com' },
  { name: 'Brembo', slug: 'brembo', domain: 'brembo.com' },
  { name: 'Vorsteiner', slug: 'vorsteiner', domain: 'vorsteiner.com' },
  { name: 'Armytrix', slug: 'armytrix', domain: 'armytrix.com' },
  { name: 'CSF', slug: 'csf', domain: 'csfrace.com' },
  { name: 'Manhart', slug: 'manhart', domain: 'manhart-performance.de' },
  { name: 'Renntech', slug: 'renntech', domain: 'renntechmercedes.com' },
  { name: 'Velos Wheels', slug: 'velos', domain: 'velosdesignwerks.com' },
  { name: 'Weistec', slug: 'weistec', domain: 'weistec.com' },
  // Additional popular brands
  { name: 'Novitec', slug: 'novitec', domain: 'novitecgroup.com' },
  { name: 'Brabus', slug: 'brabus', domain: 'brabus.com' },
  { name: 'ABT', slug: 'abt', domain: 'abt-sportsline.com' },
  { name: 'Techart', slug: 'techart', domain: 'techart.de' },
  { name: 'IPE', slug: 'ipe', domain: 'ipe-exhaust.com' },
  { name: 'AWE', slug: 'awe', domain: 'awe-tuning.com' },
  { name: 'H&R', slug: 'hr', domain: 'h-r.com' },
  { name: 'Eibach', slug: 'eibach', domain: 'eibach.com' },
  { name: 'BBS', slug: 'bbs', domain: 'bbs.com' },
  { name: 'OZ Racing', slug: 'oz-racing', domain: 'ozracing.com' },
  { name: 'Bilstein', slug: 'bilstein', domain: 'bilstein.com' },
  { name: 'Ohlins', slug: 'ohlins', domain: 'ohlins.com' },
  { name: 'Capristo', slug: 'capristo', domain: 'capristo.de' },
  { name: 'Fi Exhaust', slug: 'fi-exhaust', domain: 'fi-exhaust.com' },
];

function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/png,image/*,*/*;q=0.8',
      },
      timeout: 15000,
    }, (response) => {
      // Handle redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchUrl(response.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
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

async function downloadLogo(brand: typeof TOP_BRANDS[0]): Promise<{ success: boolean; file?: string; source?: string }> {
  const sources = [
    // WebP from Logo.dev (best for web)
    {
      name: 'Logo.dev WebP',
      url: `https://img.logo.dev/${brand.domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=webp&size=400`,
      ext: '.webp',
    },
    // PNG fallback from Logo.dev
    {
      name: 'Logo.dev PNG',
      url: `https://img.logo.dev/${brand.domain}?token=pk_X-FqniF5QEWLDfaalwQ0mA&format=png&size=400`,
      ext: '.png',
    },
    // Clearbit (usually high quality)
    {
      name: 'Clearbit',
      url: `https://logo.clearbit.com/${brand.domain}`,
      ext: '.png',
    },
    // DuckDuckGo icons
    {
      name: 'DuckDuckGo',
      url: `https://icons.duckduckgo.com/ip3/${brand.domain}.ico`,
      ext: '.ico',
    },
  ];

  for (const source of sources) {
    try {
      console.log(`    📥 Trying ${source.name}...`);
      const buffer = await fetchUrl(source.url);
      
      // Validate image size (min 1KB)
      if (buffer.length < 1000) {
        console.log(`    ⚠️  ${source.name}: Too small (${buffer.length} bytes)`);
        continue;
      }

      const fileName = `${brand.slug}${source.ext}`;
      const filePath = path.join(LOGO_DIR, fileName);
      
      await fs.writeFile(filePath, buffer);
      console.log(`    ✅ Success: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
      
      return { success: true, file: fileName, source: source.name };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`    ❌ ${source.name}: ${msg}`);
    }
  }
  
  return { success: false };
}

async function updateBrandLogosTs(results: Map<string, string>) {
  const brandLogosPath = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');
  let content = await fs.readFile(brandLogosPath, 'utf-8');
  
  for (const [brandName, fileName] of results) {
    const logoPath = `/logos/${fileName}`;
    
    // Check if brand already exists in the map
    const existingPattern = new RegExp(`'${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'[^']*'`, 'g');
    
    if (existingPattern.test(content)) {
      // Update existing entry
      content = content.replace(existingPattern, `'${brandName}': '${logoPath}'`);
    } else {
      // Add new entry after opening brace
      const insertPoint = content.indexOf('= {') + 3;
      content = content.slice(0, insertPoint) + `\n  '${brandName}': '${logoPath}',` + content.slice(insertPoint);
    }
  }
  
  await fs.writeFile(brandLogosPath, content, 'utf-8');
  console.log('\n📝 Updated brandLogos.ts');
}

async function main() {
  console.log('🚀 Downloading TOP Brand Logos (WebP preferred)\n');
  console.log('='.repeat(60) + '\n');

  await fs.mkdir(LOGO_DIR, { recursive: true });

  const results = new Map<string, string>();
  const stats = { success: 0, failed: 0 };

  for (let i = 0; i < TOP_BRANDS.length; i++) {
    const brand = TOP_BRANDS[i];
    console.log(`[${i + 1}/${TOP_BRANDS.length}] ${brand.name} (${brand.domain})`);
    
    const result = await downloadLogo(brand);
    
    if (result.success && result.file) {
      results.set(brand.name, result.file);
      stats.success++;
    } else {
      stats.failed++;
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // Update brandLogos.ts
  if (results.size > 0) {
    await updateBrandLogosTs(results);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Downloaded: ${stats.success}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
