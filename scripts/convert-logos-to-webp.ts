/**
 * Script to convert existing PNG/JPEG logos to WebP format
 * WebP provides 25-35% better compression than PNG while maintaining quality
 * 
 * Run: npx tsx scripts/convert-logos-to-webp.ts
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const BRAND_LOGOS_PATH = path.join(process.cwd(), 'src', 'lib', 'brandLogos.ts');

// Extensions to convert (SVG stays as-is, it's already optimal)
const CONVERTIBLE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

interface ConversionResult {
  original: string;
  converted: string;
  originalSize: number;
  newSize: number;
  savings: number;
}

async function convertToWebP(filePath: string): Promise<ConversionResult | null> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!CONVERTIBLE_EXTENSIONS.includes(ext)) {
    return null;
  }

  const baseName = path.basename(filePath, ext);
  const webpPath = path.join(LOGO_DIR, `${baseName}.webp`);
  
  // Check if WebP already exists
  try {
    await fs.access(webpPath);
    console.log(`  ⏭️  WebP already exists: ${baseName}.webp`);
    return null;
  } catch {
    // WebP doesn't exist, proceed with conversion
  }

  try {
    const originalBuffer = await fs.readFile(filePath);
    const originalSize = originalBuffer.length;

    // Convert to WebP with high quality
    const webpBuffer = await sharp(originalBuffer)
      .webp({ 
        quality: 90,
        effort: 6, // Higher effort = better compression
        lossless: false,
        nearLossless: true,
      })
      .toBuffer();

    const newSize = webpBuffer.length;
    const savings = ((originalSize - newSize) / originalSize * 100);

    // Only save if WebP is smaller
    if (newSize < originalSize) {
      await fs.writeFile(webpPath, webpBuffer);
      
      return {
        original: path.basename(filePath),
        converted: `${baseName}.webp`,
        originalSize,
        newSize,
        savings,
      };
    } else {
      console.log(`  ⚠️  WebP larger than original for ${baseName}, keeping original`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Failed to convert ${filePath}:`, error);
    return null;
  }
}

async function updateBrandLogosMap(conversions: ConversionResult[]) {
  const content = await fs.readFile(BRAND_LOGOS_PATH, 'utf-8');
  
  let updatedContent = content;
  
  for (const conversion of conversions) {
    // Replace .png/.jpg references with .webp
    const originalExt = path.extname(conversion.original);
    const baseName = path.basename(conversion.original, originalExt);
    
    const oldPath = `/logos/${conversion.original}`;
    const newPath = `/logos/${conversion.converted}`;
    
    updatedContent = updatedContent.replace(
      new RegExp(`'${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
      `'${newPath}'`
    );
  }
  
  await fs.writeFile(BRAND_LOGOS_PATH, updatedContent, 'utf-8');
}

async function main() {
  console.log('🖼️  Logo WebP Converter\n');
  console.log('Converting PNG/JPEG logos to WebP for better performance...\n');

  // Check if sharp is installed
  try {
    await import('sharp');
  } catch {
    console.error('❌ sharp is not installed. Run: npm install sharp');
    process.exit(1);
  }

  const files = await fs.readdir(LOGO_DIR);
  const conversions: ConversionResult[] = [];
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;

  for (const file of files) {
    const filePath = path.join(LOGO_DIR, file);
    const ext = path.extname(file).toLowerCase();
    
    if (!CONVERTIBLE_EXTENSIONS.includes(ext)) {
      continue;
    }

    console.log(`📦 Processing: ${file}`);
    
    const result = await convertToWebP(filePath);
    
    if (result) {
      conversions.push(result);
      totalOriginalSize += result.originalSize;
      totalNewSize += result.newSize;
      console.log(`  ✅ Converted: ${result.original} → ${result.converted}`);
      console.log(`     Size: ${(result.originalSize / 1024).toFixed(1)}KB → ${(result.newSize / 1024).toFixed(1)}KB (${result.savings.toFixed(1)}% saved)`);
    }
  }

  if (conversions.length === 0) {
    console.log('\n✨ No new conversions needed!');
    return;
  }

  // Update brandLogos.ts
  console.log('\n📝 Updating brandLogos.ts...');
  await updateBrandLogosMap(conversions);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONVERSION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files converted:     ${conversions.length}`);
  console.log(`Original total size: ${(totalOriginalSize / 1024).toFixed(1)} KB`);
  console.log(`New total size:      ${(totalNewSize / 1024).toFixed(1)} KB`);
  console.log(`Total savings:       ${((totalOriginalSize - totalNewSize) / 1024).toFixed(1)} KB (${((totalOriginalSize - totalNewSize) / totalOriginalSize * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  console.log('\n⚠️  Note: Original files are preserved. You can delete them manually after verifying.');
  console.log('   To delete originals, run: npm run cleanup-logos');
}

main().catch(console.error);
