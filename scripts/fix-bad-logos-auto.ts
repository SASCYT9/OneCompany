/**
 * Logo Auto-Fixer using Google Gemini + Web Search
 * 
 * This script:
 * 1. Reads the logo quality report
 * 2. For logos with poor/unusable quality, searches for better versions
 * 3. Uses Google Custom Search API or Brandfetch to find official logos
 * 4. Downloads and replaces low-quality logos with better ones
 * 
 * Usage:
 *   GEMINI_API_KEY=your_key npx tsx scripts/fix-bad-logos-auto.ts
 *   
 * Options:
 *   --dry-run     - Show what would be done without making changes
 *   --threshold=N - Fix logos with quality score below N (default: 40)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const LOGOS_DIR = path.join(__dirname, '../public/logos');
const REPORT_PATH = path.join(__dirname, '../logo-quality-report.json');
const BACKUP_DIR = path.join(__dirname, '../public/logos-backup');

interface LogoAnalysis {
  filename: string;
  path: string;
  fileSize: number;
  format: string;
  analysis: {
    quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
    qualityScore: number;
    hasTransparentBackground: boolean;
    backgroundColor: string;
    isVectorFormat: boolean;
    estimatedResolution: string;
    issues: string[];
    suggestions: string[];
    description: string;
  };
  timestamp: string;
}

interface Report {
  generatedAt: string;
  totalAnalyzed: number;
  stats: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
    unusable: number;
    totalIssues: number;
  };
  analyses: LogoAnalysis[];
}

interface SearchResult {
  url: string;
  width?: number;
  height?: number;
  format: string;
  source: string;
}

// Brand name extraction from filename
function extractBrandName(filename: string): string {
  // Remove extension and common suffixes
  let brand = filename
    .replace(/\.(png|jpg|jpeg|webp|svg)$/i, '')
    .replace(/-logo$/, '')
    .replace(/_logo$/, '');
  
  // Convert to readable format
  brand = brand
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return brand;
}

// Use Gemini to understand brand and suggest search queries
async function getSearchQueriesFromGemini(
  brandName: string,
  currentIssues: string[],
  apiKey: string
): Promise<string[]> {
  const prompt = `You are helping to find a high-quality logo for the brand "${brandName}" (an automotive/motorcycle tuning parts brand).

Current logo issues:
${currentIssues.map(i => `- ${i}`).join('\n')}

Generate 3 specific Google Image search queries that would help find:
1. The official transparent PNG logo
2. The official SVG/vector logo
3. A high-resolution version of the logo

Respond ONLY with a JSON array of 3 search query strings, nothing else.
Example: ["BrandName official logo transparent PNG", "BrandName vector logo SVG", "BrandName high resolution logo"]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Parse JSON from response
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '');
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error getting search queries:', error);
    return [
      `${brandName} official logo transparent PNG`,
      `${brandName} logo SVG vector`,
      `${brandName} brand logo high resolution`
    ];
  }
}

// Try to find logo on Brandfetch (free tier)
async function searchBrandfetch(brandName: string): Promise<SearchResult | null> {
  const domain = brandName.toLowerCase().replace(/\s+/g, '') + '.com';
  
  try {
    // First try to get logo from Clearbit (free, no API key needed)
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    
    const response = await fetch(clearbitUrl, { method: 'HEAD' });
    if (response.ok) {
      return {
        url: clearbitUrl,
        format: 'png',
        source: 'clearbit'
      };
    }
  } catch {
    // Clearbit didn't work, continue
  }
  
  return null;
}

// Search for logo using Google Custom Search (if API key provided)
async function searchGoogleImages(
  query: string,
  googleApiKey?: string,
  searchEngineId?: string
): Promise<SearchResult[]> {
  if (!googleApiKey || !searchEngineId) {
    return [];
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&searchType=image&imgSize=large&fileType=png,svg&num=5`;
    
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return (data.items || []).map((item: { link: string; image?: { width?: number; height?: number } }) => ({
      url: item.link,
      width: item.image?.width,
      height: item.image?.height,
      format: item.link.toLowerCase().endsWith('.svg') ? 'svg' : 'png',
      source: 'google'
    }));
  } catch {
    return [];
  }
}

// Try alternative logo sources
async function searchAlternativeSources(brandName: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const brandSlug = brandName.toLowerCase().replace(/\s+/g, '-');
  
  // Try common logo CDNs and sources
  const sources = [
    // Clearbit
    `https://logo.clearbit.com/${brandName.toLowerCase().replace(/\s+/g, '')}.com`,
    // Brand Logos (various domains)
    `https://www.${brandName.toLowerCase().replace(/\s+/g, '')}.com/logo.png`,
    `https://www.${brandName.toLowerCase().replace(/\s+/g, '')}.com/images/logo.png`,
    // Wikipedia commons (for well-known brands)
    `https://upload.wikimedia.org/wikipedia/commons/thumb/${brandSlug}-logo.svg`,
  ];
  
  for (const url of sources) {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          results.push({
            url,
            format: contentType.includes('svg') ? 'svg' : 'png',
            source: new URL(url).hostname
          });
        }
      }
    } catch {
      // Continue to next source
    }
  }
  
  return results;
}

// Download image to file
async function downloadImage(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadImage(redirectUrl, destPath).then(resolve);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        resolve(false);
        return;
      }
      
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
      
      fileStream.on('error', () => {
        fs.unlinkSync(destPath);
        resolve(false);
      });
    });
    
    request.on('error', () => resolve(false));
    request.setTimeout(10000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

// Verify downloaded image quality with Gemini
async function verifyImageQuality(imagePath: string, apiKey: string): Promise<number> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.svg' ? 'image/svg+xml' : ext === '.webp' ? 'image/webp' : 'image/png';

    if (mimeType === 'image/svg+xml') {
      // SVGs are generally good quality
      return 85;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Rate this logo image quality from 0-100 for use on a premium website. Consider: clarity, resolution, professional appearance, background transparency. Respond with ONLY a number.' },
              { inline_data: { mime_type: mimeType, data: base64Image } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
        })
      }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '0';
    return parseInt(text.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function fixLogo(
  logoAnalysis: LogoAnalysis,
  apiKey: string,
  dryRun: boolean
): Promise<{ success: boolean; newPath?: string; source?: string }> {
  const brandName = extractBrandName(logoAnalysis.filename);
  console.log(`\n🔍 Searching for better logo: ${brandName}`);

  // Get smart search queries from Gemini
  const searchQueries = await getSearchQueriesFromGemini(
    brandName,
    logoAnalysis.analysis.issues,
    apiKey
  );

  // Try multiple sources
  const candidates: SearchResult[] = [];

  // 1. Try Brandfetch/Clearbit first (most reliable)
  const brandfetchResult = await searchBrandfetch(brandName);
  if (brandfetchResult) {
    candidates.push(brandfetchResult);
    console.log(`   ✓ Found on Clearbit`);
  }

  // 2. Try alternative sources
  const altResults = await searchAlternativeSources(brandName);
  candidates.push(...altResults);
  if (altResults.length > 0) {
    console.log(`   ✓ Found ${altResults.length} alternative source(s)`);
  }

  // 3. If Google API is available, search there too
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (googleApiKey && searchEngineId) {
    for (const query of searchQueries.slice(0, 2)) {
      const googleResults = await searchGoogleImages(query, googleApiKey, searchEngineId);
      candidates.push(...googleResults);
    }
    if (candidates.length > 0) {
      console.log(`   ✓ Found ${candidates.length} Google result(s)`);
    }
  }

  if (candidates.length === 0) {
    console.log(`   ❌ No alternative logos found`);
    return { success: false };
  }

  if (dryRun) {
    console.log(`   📋 [DRY RUN] Would try ${candidates.length} candidate(s)`);
    return { success: true, source: 'dry-run' };
  }

  // Create backup
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const backupPath = path.join(BACKUP_DIR, logoAnalysis.filename);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(logoAnalysis.path, backupPath);
  }

  // Try each candidate
  for (const candidate of candidates) {
    const tempPath = path.join(LOGOS_DIR, `temp_${Date.now()}_${logoAnalysis.filename}`);
    
    console.log(`   ⬇️ Trying: ${candidate.source} (${candidate.format})`);
    
    const downloaded = await downloadImage(candidate.url, tempPath);
    if (!downloaded) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      continue;
    }

    // Verify quality
    const quality = await verifyImageQuality(tempPath, apiKey);
    console.log(`   📊 Quality score: ${quality}/100`);

    if (quality > logoAnalysis.analysis.qualityScore) {
      // Better quality! Replace the original
      const newFilename = logoAnalysis.filename.replace(/\.(png|jpg|jpeg|webp)$/i, 
        candidate.format === 'svg' ? '.svg' : '.png');
      const newPath = path.join(LOGOS_DIR, newFilename);
      
      fs.renameSync(tempPath, newPath);
      
      // Remove old file if different format
      if (newPath !== logoAnalysis.path && fs.existsSync(logoAnalysis.path)) {
        fs.unlinkSync(logoAnalysis.path);
      }
      
      console.log(`   ✅ Replaced with better version (${quality} vs ${logoAnalysis.analysis.qualityScore})`);
      return { success: true, newPath, source: candidate.source };
    } else {
      fs.unlinkSync(tempPath);
    }
  }

  console.log(`   ⚠️ No better version found`);
  return { success: false };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const thresholdArg = args.find(a => a.startsWith('--threshold='));
  const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 40;

  // Check if report exists
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('❌ Error: Logo quality report not found.');
    console.log('   Run `npm run analyze-logos -- --report` first.');
    process.exit(1);
  }

  const report: Report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  
  console.log('🔧 Logo Auto-Fixer');
  console.log('═'.repeat(60));
  console.log(`\n📊 Report from: ${report.generatedAt}`);
  console.log(`📋 Quality threshold: ${threshold}/100`);
  if (dryRun) console.log('🔍 DRY RUN MODE - no changes will be made\n');

  // Find logos needing fixing
  const logosToFix = report.analyses.filter(a => a.analysis.qualityScore < threshold);
  
  console.log(`\n⚠️ Found ${logosToFix.length} logos below quality threshold\n`);

  if (logosToFix.length === 0) {
    console.log('✅ All logos meet quality standards!');
    return;
  }

  // Sort by quality score (worst first)
  logosToFix.sort((a, b) => a.analysis.qualityScore - b.analysis.qualityScore);

  let fixed = 0;
  let failed = 0;

  for (const logo of logosToFix) {
    const result = await fixLogo(logo, apiKey, dryRun);
    if (result.success) {
      fixed++;
    } else {
      failed++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Logos processed: ${logosToFix.length}`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Could not fix: ${failed}`);
  
  if (!dryRun && fixed > 0) {
    console.log(`\n   💾 Original logos backed up to: ${BACKUP_DIR}`);
    console.log(`   🔄 Run analyze-logos again to verify improvements`);
  }
}

main().catch(console.error);
