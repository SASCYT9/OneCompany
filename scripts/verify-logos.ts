
import fs from 'fs/promises';
import path from 'path';
import sizeOf from 'image-size';
import sharp from 'sharp';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');
const MIN_DIMENSION = 80; // Minimum width or height in pixels
const IGNORE_SMALL_FILES = new Set([
  'eventuri.svg',
  'vr-performance.svg',
  'mega3-performance.svg',
  'twm.svg',
  'adro.svg',
  'alpha-n.svg',
  'borla.svg',
  'brabus.svg',
  'burger-motorsport.svg',
  'dmc.svg',
  'full-race.svg',
  'healtech.svg',
  'lamborghini.svg',
  'mickey-thompson.svg',
  'novitec.svg',
  'protrack-wheels.svg',
  'stm-italy.svg',
  'wheelforce.svg',
  'xhp.svg',
  'zacoe.svg',
  'bitubo-suspension.svg',
]);

interface ProblematicLogo {
  file: string;
  reason: string;
  details: string;
}

const verifyLogos = async () => {
  console.log('🔍 Starting logo verification process...');
  const problematicLogos: ProblematicLogo[] = [];

  try {
    const files = await fs.readdir(LOGO_DIR);

    for (const file of files) {
      const filePath = path.join(LOGO_DIR, file);
      const fileExtension = path.extname(file).toLowerCase();

      // 1. Check for corruption with Sharp
      try {
        await sharp(filePath).metadata();
      } catch (error) {
        problematicLogos.push({
          file,
          reason: 'Corrupted File',
          details: `Sharp failed to process: ${(error as Error).message}`,
        });
        continue; // Skip to next file if corrupted
      }

      // 2. Check dimensions for non-SVG files
      if (fileExtension !== '.svg') {
        try {
          const buffer = await fs.readFile(filePath);
          const dimensions = sizeOf(buffer);
          if (
            (dimensions.width ?? 0) < MIN_DIMENSION ||
            (dimensions.height ?? 0) < MIN_DIMENSION
          ) {
            if (!IGNORE_SMALL_FILES.has(file)) {
              problematicLogos.push({
                file,
                reason: 'Low Resolution',
                details: `Dimensions: ${dimensions.width}x${dimensions.height}`,
              });
            }
          }
        } catch (error) {
          problematicLogos.push({
            file,
            reason: 'Dimension Check Failed',
            details: `image-size failed: ${(error as Error).message}`,
          });
        }
      }
    }

    if (problematicLogos.length > 0) {
      console.log('\n❌ Found problematic logos:');
      console.table(problematicLogos);
    } else {
      console.log('\n✅ All logos seem to be in good shape!');
    }
  } catch (error) {
    console.error('An error occurred during verification:', error);
  }
};

verifyLogos();
