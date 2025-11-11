import { allAutomotiveBrands, allMotoBrands } from '../src/lib/brands';
import { BRAND_LOGO_MAP } from '../src/lib/brandLogos';
import fs from 'fs';
import path from 'path';

const LOGO_DIR = path.join(process.cwd(), 'public', 'logos');

// Get all brands
const allBrands = [...allAutomotiveBrands, ...allMotoBrands];

console.log('🔍 Checking for missing logos...\n');
console.log(`Total brands in system: ${allBrands.length}`);
console.log(`Brands with logos in map: ${Object.keys(BRAND_LOGO_MAP).length}\n`);

// Find brands without logos in the map
const brandsWithoutLogos = allBrands.filter(brand => !BRAND_LOGO_MAP[brand.name]);

// Find brands with placeholder logo
const brandsWithPlaceholder: string[] = [];
const brandsWithActualLogos: string[] = [];

for (const brand of allBrands) {
  const logoPath = BRAND_LOGO_MAP[brand.name];
  if (logoPath) {
    if (logoPath.includes('placeholder')) {
      brandsWithPlaceholder.push(brand.name);
    } else {
      // Check if file actually exists
      const fullPath = path.join(LOGO_DIR, path.basename(logoPath));
      if (fs.existsSync(fullPath)) {
        brandsWithActualLogos.push(brand.name);
      } else {
        brandsWithPlaceholder.push(brand.name);
      }
    }
  }
}

console.log('📊 STATISTICS:\n');
console.log(`✅ Brands with actual logos: ${brandsWithActualLogos.length}`);
console.log(`❌ Brands without logos in map: ${brandsWithoutLogos.length}`);
console.log(`⚠️  Brands with placeholder: ${brandsWithPlaceholder.length}`);
console.log(`\n${'='.repeat(60)}\n`);

if (brandsWithoutLogos.length > 0) {
  console.log('❌ BRANDS WITHOUT LOGOS IN MAP:\n');
  brandsWithoutLogos.forEach((brand, i) => {
    console.log(`${i + 1}. ${brand.name}`);
  });
  console.log(`\n${'='.repeat(60)}\n`);
}

if (brandsWithPlaceholder.length > 0) {
  console.log('⚠️  BRANDS WITH PLACEHOLDER OR MISSING FILES:\n');
  brandsWithPlaceholder.forEach((name, i) => {
    console.log(`${i + 1}. ${name}`);
  });
  console.log(`\n${'='.repeat(60)}\n`);
}

// Create list for manual download
const missingBrands = [...brandsWithoutLogos.map(b => b.name), ...brandsWithPlaceholder];

if (missingBrands.length > 0) {
  console.log(`\n💡 Total brands needing logos: ${missingBrands.length}`);
  console.log('\n🔧 To download missing logos, these brands need to be processed:\n');

  const uniqueMissing = [...new Set(missingBrands)];
  console.log(JSON.stringify(uniqueMissing, null, 2));
}

process.exit(0);
