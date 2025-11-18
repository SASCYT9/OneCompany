
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { glob } from 'glob';

const LOGOS_DIR = path.join(process.cwd(), 'public/logos');
const THRESHOLD = 60; // Luminance threshold (0-255). Below this is considered "dark".

async function checkLogos() {
  console.log('🔍 Scanning for dark logos...');
  
  // Find all logo files
  const files = glob.sync('**/*.{png,jpg,jpeg,webp}', { cwd: LOGOS_DIR });
  
  const darkLogos: string[] = [];
  const errorLogos: string[] = [];

  for (const file of files) {
    const filePath = path.join(LOGOS_DIR, file);
    
    try {
      const image = sharp(filePath);
      const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let totalLuminance = 0;
      let pixelCount = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Only consider non-transparent pixels
        if (a > 10) {
          // Relative luminance formula
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          totalLuminance += luminance;
          pixelCount++;
        }
      }

      if (pixelCount > 0) {
        const avgLuminance = totalLuminance / pixelCount;
        if (avgLuminance < THRESHOLD) {
          console.log(`⚫ Dark logo found: ${file} (Avg Luminance: ${avgLuminance.toFixed(2)})`);
          darkLogos.push(file);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err);
      errorLogos.push(file);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`Total scanned: ${files.length}`);
  console.log(`Dark logos found: ${darkLogos.length}`);
  console.log(`Errors: ${errorLogos.length}`);

  if (darkLogos.length > 0) {
    console.log('\n📋 List of dark logos:');
    darkLogos.forEach(l => console.log(`- ${l}`));
    
    // Generate a JSON file with the list
    fs.writeFileSync(
      path.join(process.cwd(), 'scripts/dark-logos.json'), 
      JSON.stringify(darkLogos, null, 2)
    );
    console.log('\n💾 Saved list to scripts/dark-logos.json');
  }
}

checkLogos();
