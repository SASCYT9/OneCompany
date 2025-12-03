
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos');
const OUTPUT_FILE = path.join(process.cwd(), 'scripts', 'dark-logos.json');

async function checkTransparency(filePath: string): Promise<boolean> {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    if (!metadata.hasAlpha) return false;

    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Check for any transparent pixels
    // We'll check a sample of pixels to be fast
    const pixelCount = info.width * info.height;
    const step = Math.max(1, Math.floor(pixelCount / 1000)); // Check ~1000 pixels

    for (let i = 0; i < pixelCount; i += step) {
      const alpha = data[i * info.channels + 3]; // 4th channel is alpha
      if (alpha < 255) {
        return true; // Found a transparent pixel
      }
    }

    return false; // No transparent pixels found
  } catch (error) {
    console.error(`Error checking ${path.basename(filePath)}:`, error);
    return false; // Assume bad if error
  }
}

async function main() {
  const files = fs.readdirSync(LOGOS_DIR);
  const solidLogos: string[] = [];

  console.log(`Scanning ${files.length} logos...`);

  for (const file of files) {
    if (file.endsWith('.svg')) continue; // SVGs are usually fine
    
    const filePath = path.join(LOGOS_DIR, file);
    
    // JPGs are always solid
    if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
      solidLogos.push(file);
      continue;
    }

    // Check PNG/WebP for transparency
    if (file.endsWith('.png') || file.endsWith('.webp')) {
      const isTransparent = await checkTransparency(filePath);
      if (!isTransparent) {
        solidLogos.push(file);
        process.stdout.write('x');
      } else {
        process.stdout.write('.');
      }
    }
  }

  console.log(`\nFound ${solidLogos.length} solid logos.`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(solidLogos, null, 2));
  console.log(`List saved to ${OUTPUT_FILE}`);
}

main();
