/**
 * Logo Quality Analyzer using Google Gemini Vision API
 * 
 * This script analyzes all logos in the public/logos directory and provides:
 * - Quality assessment (resolution, clarity, artifacts)
 * - Background analysis (transparent, white, dark, etc.)
 * - Format recommendations
 * - Brand consistency check
 * - Suggestions for improvement
 * 
 * Usage:
 *   GEMINI_API_KEY=your_key npx ts-node scripts/analyze-logos-gemini.ts
 *   
 * Options:
 *   --brand=BrandName  - Analyze specific brand only
 *   --fix              - Attempt to fix issues automatically
 *   --report           - Generate detailed report file
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGOS_DIR = path.join(__dirname, '../public/logos');
const REPORT_PATH = path.join(__dirname, '../logo-quality-report.json');

interface LogoAnalysis {
  filename: string;
  path: string;
  fileSize: number;
  format: string;
  analysis: {
    quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
    qualityScore: number; // 0-100
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

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

async function analyzeLogoWithGemini(
  imagePath: string,
  apiKey: string
): Promise<LogoAnalysis['analysis']> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.svg') 
    ? 'image/svg+xml' 
    : imagePath.endsWith('.png') 
      ? 'image/png' 
      : imagePath.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

  // For SVG files, we'll do basic analysis without vision API
  if (mimeType === 'image/svg+xml') {
    const svgContent = fs.readFileSync(imagePath, 'utf-8');
    return analyzeSvgLocally(svgContent);
  }

  const prompt = `You are a professional brand designer analyzing a logo image for quality and usability on a premium automotive/motorcycle tuning parts website.

Analyze this logo image and provide a JSON response with the following structure:
{
  "quality": "excellent" | "good" | "acceptable" | "poor" | "unusable",
  "qualityScore": 0-100,
  "hasTransparentBackground": true/false,
  "backgroundColor": "transparent" | "white" | "black" | "dark" | "light" | "colored" | "gradient",
  "isVectorFormat": false,
  "estimatedResolution": "high (suitable for large displays)" | "medium (suitable for web)" | "low (may appear pixelated)",
  "issues": ["list of specific issues found"],
  "suggestions": ["list of specific improvements recommended"],
  "description": "Brief description of the logo appearance and brand it represents"
}

Consider these factors:
1. Image clarity and sharpness (no blur, pixelation, or artifacts)
2. Background type (transparent preferred for web use)
3. Color accuracy and contrast
4. Professional appearance suitable for a premium brand website
5. File quality (compression artifacts, noise)
6. Whether the logo would look good on both light and dark backgrounds
7. Whether text (if any) is readable

Be strict in your quality assessment - this is for a premium tuning parts website.
Respond ONLY with the JSON object, no additional text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('No response from Gemini API');
    }

    // Parse JSON from response (handle markdown code blocks if present)
    let jsonStr = textResponse.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error(`Error analyzing ${imagePath}:`, error);
    return {
      quality: 'poor',
      qualityScore: 0,
      hasTransparentBackground: false,
      backgroundColor: 'unknown',
      isVectorFormat: false,
      estimatedResolution: 'unknown',
      issues: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      suggestions: ['Manual review required'],
      description: 'Analysis could not be completed',
    };
  }
}

function analyzeSvgLocally(svgContent: string): LogoAnalysis['analysis'] {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let qualityScore = 85; // SVGs start with a good baseline

  // Check for common SVG issues
  const hasViewBox = svgContent.includes('viewBox');
  const hasInlineStyles = svgContent.includes('style=');
  const hasEmbeddedRaster = svgContent.includes('data:image/png') || svgContent.includes('data:image/jpeg');
  const hasClipPath = svgContent.includes('clip-path') || svgContent.includes('clipPath');
  const hasMask = svgContent.includes('<mask');
  const fileSize = Buffer.byteLength(svgContent, 'utf-8');

  if (!hasViewBox) {
    issues.push('SVG missing viewBox attribute - may not scale properly');
    suggestions.push('Add viewBox attribute for proper scaling');
    qualityScore -= 10;
  }

  if (hasEmbeddedRaster) {
    issues.push('SVG contains embedded raster images - not truly vector');
    suggestions.push('Replace embedded raster images with vector paths');
    qualityScore -= 20;
  }

  if (fileSize > 100000) {
    issues.push(`Large SVG file size (${(fileSize / 1024).toFixed(1)}KB) - may affect performance`);
    suggestions.push('Optimize SVG using SVGO or similar tool');
    qualityScore -= 5;
  }

  if (hasInlineStyles) {
    suggestions.push('Consider using CSS classes instead of inline styles for better maintainability');
  }

  // Determine quality rating
  let quality: LogoAnalysis['analysis']['quality'];
  if (qualityScore >= 80) quality = 'excellent';
  else if (qualityScore >= 60) quality = 'good';
  else if (qualityScore >= 40) quality = 'acceptable';
  else if (qualityScore >= 20) quality = 'poor';
  else quality = 'unusable';

  return {
    quality,
    qualityScore,
    hasTransparentBackground: true, // SVGs inherently support transparency
    backgroundColor: 'transparent',
    isVectorFormat: !hasEmbeddedRaster,
    estimatedResolution: 'vector (infinitely scalable)',
    issues,
    suggestions: suggestions.length > 0 ? suggestions : ['SVG format is ideal - no changes needed'],
    description: 'Vector SVG logo format',
  };
}

async function getLogoFiles(): Promise<string[]> {
  const files = fs.readdirSync(LOGOS_DIR);
  const allLogos = files.filter(f => 
    /\.(png|jpg|jpeg|webp|svg)$/i.test(f)
  );
  
  // Group by brand name - keep only best format per brand
  // Priority: SVG > PNG > JPG > WEBP (SVG is vector, then quality order)
  const brandMap = new Map<string, string>();
  const priority: Record<string, number> = { 
    '.svg': 4, '.png': 3, '.jpg': 2, '.jpeg': 2, '.webp': 1 
  };
  
  for (const file of allLogos) {
    const ext = path.extname(file).toLowerCase();
    const brandName = file.replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
    
    const existingFile = brandMap.get(brandName);
    if (!existingFile) {
      brandMap.set(brandName, file);
    } else {
      const existingExt = path.extname(existingFile).toLowerCase();
      if ((priority[ext] || 0) > (priority[existingExt] || 0)) {
        brandMap.set(brandName, file);
      }
    }
  }
  
  // Return unique brand logos
  return Array.from(brandMap.values()).sort();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function printAnalysis(analysis: LogoAnalysis): void {
  const qualityEmoji = {
    excellent: '✅',
    good: '👍',
    acceptable: '⚠️',
    poor: '❌',
    unusable: '🚫',
  };

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📁 ${analysis.filename}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`   Quality: ${qualityEmoji[analysis.analysis.quality]} ${analysis.analysis.quality.toUpperCase()} (${analysis.analysis.qualityScore}/100)`);
  console.log(`   Format: ${analysis.format.toUpperCase()} | Size: ${formatFileSize(analysis.fileSize)}`);
  console.log(`   Background: ${analysis.analysis.backgroundColor} | Transparent: ${analysis.analysis.hasTransparentBackground ? 'Yes' : 'No'}`);
  console.log(`   Resolution: ${analysis.analysis.estimatedResolution}`);
  
  if (analysis.analysis.issues.length > 0) {
    console.log(`   Issues:`);
    analysis.analysis.issues.forEach(issue => console.log(`     ⚠️  ${issue}`));
  }
  
  if (analysis.analysis.suggestions.length > 0) {
    console.log(`   Suggestions:`);
    analysis.analysis.suggestions.forEach(sug => console.log(`     💡 ${sug}`));
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    console.log('\nUsage:');
    console.log('  $env:GEMINI_API_KEY="your_key"; npx ts-node scripts/analyze-logos-gemini.ts');
    console.log('\nOptions:');
    console.log('  --brand=BrandName  - Analyze specific brand only');
    console.log('  --report           - Save detailed report to file');
    console.log('  --limit=N          - Analyze only first N logos');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const brandFilter = args.find(a => a.startsWith('--brand='))?.split('=')[1]?.toLowerCase();
  const generateReport = args.includes('--report');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('🔍 Logo Quality Analyzer (Powered by Gemini Vision)');
  console.log('═'.repeat(60));

  let logoFiles = await getLogoFiles();
  
  if (brandFilter) {
    logoFiles = logoFiles.filter(f => f.toLowerCase().includes(brandFilter));
    console.log(`\n📋 Filtering for brand: "${brandFilter}"`);
  }

  if (limit && limit > 0) {
    logoFiles = logoFiles.slice(0, limit);
    console.log(`📋 Limiting to first ${limit} logos`);
  }

  console.log(`\n📊 Found ${logoFiles.length} logo files to analyze\n`);

  const analyses: LogoAnalysis[] = [];
  let processed = 0;
  const startTime = Date.now();

  // Stats counters
  const stats = {
    excellent: 0,
    good: 0,
    acceptable: 0,
    poor: 0,
    unusable: 0,
    totalIssues: 0,
  };

  for (const file of logoFiles) {
    processed++;
    const filePath = path.join(LOGOS_DIR, file);
    const fileStats = fs.statSync(filePath);
    const format = path.extname(file).slice(1).toLowerCase();

    process.stdout.write(`\r⏳ Analyzing ${processed}/${logoFiles.length}: ${file.padEnd(40)}`);

    // Add small delay to respect API rate limits (reduced from 500ms)
    if (processed > 1 && format !== 'svg') {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const analysis = await analyzeLogoWithGemini(filePath, apiKey);

    const logoAnalysis: LogoAnalysis = {
      filename: file,
      path: filePath,
      fileSize: fileStats.size,
      format,
      analysis,
      timestamp: new Date().toISOString(),
    };

    analyses.push(logoAnalysis);
    stats[analysis.quality]++;
    stats.totalIssues += analysis.issues.length;

    // Print analysis if there are issues or quality is below good
    if (analysis.quality !== 'excellent' && analysis.quality !== 'good') {
      printAnalysis(logoAnalysis);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\n   Total logos analyzed: ${analyses.length}`);
  console.log(`   Time taken: ${duration}s`);
  console.log(`\n   Quality Distribution:`);
  console.log(`     ✅ Excellent: ${stats.excellent} (${((stats.excellent / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`     👍 Good: ${stats.good} (${((stats.good / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`     ⚠️  Acceptable: ${stats.acceptable} (${((stats.acceptable / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`     ❌ Poor: ${stats.poor} (${((stats.poor / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`     🚫 Unusable: ${stats.unusable} (${((stats.unusable / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`\n   Total issues found: ${stats.totalIssues}`);

  // List logos needing attention
  const needsAttention = analyses.filter(a => 
    a.analysis.quality === 'poor' || a.analysis.quality === 'unusable'
  );

  if (needsAttention.length > 0) {
    console.log(`\n   ⚠️  Logos needing immediate attention:`);
    needsAttention.forEach(a => {
      console.log(`     - ${a.filename} (${a.analysis.quality})`);
    });
  }

  // Save report if requested
  if (generateReport) {
    const report = {
      generatedAt: new Date().toISOString(),
      totalAnalyzed: analyses.length,
      stats,
      analyses: analyses.sort((a, b) => a.analysis.qualityScore - b.analysis.qualityScore),
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n📝 Detailed report saved to: ${REPORT_PATH}`);
  }

  console.log('\n' + '═'.repeat(60));
}

main().catch(console.error);
