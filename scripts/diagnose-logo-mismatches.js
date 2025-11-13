const fs = require('fs');
const path = require('path');

// Read all logo files
const logosDir = path.join(__dirname, '../public/logos');
const logoFiles = fs.readdirSync(logosDir)
  .filter(file => file !== 'placeholder.svg')
  .sort();

// Read brands from brands.ts
const brandsFile = fs.readFileSync(path.join(__dirname, '../src/lib/brands.ts'), 'utf8');

// Extract all brand names from brands.ts
const brandNamePattern = /{\s*name:\s*['"]([^'"]+)['"]/g;
const brandNames = [];
let match;
while ((match = brandNamePattern.exec(brandsFile)) !== null) {
  brandNames.push(match[1]);
}

const uniqueBrands = [...new Set(brandNames)].sort();

console.log(`\n📊 Found ${logoFiles.length} logo files`);
console.log(`📊 Found ${uniqueBrands.length} unique brand names in brands.ts\n`);

// Simple slug function
const slug = (s) => s.toLowerCase().normalize('NFKD')
  .replace(/[''`]/g, '')
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '');

// Create maps
const logoMap = {};
logoFiles.forEach(file => {
  const nameWithoutExt = file.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
  const fileSlug = slug(nameWithoutExt);
  logoMap[fileSlug] = file;
});

// Find mismatches
const mismatches = [];
const matched = [];

uniqueBrands.forEach(brandName => {
  const brandSlug = slug(brandName);
  
  if (logoMap[brandSlug]) {
    matched.push({ brand: brandName, file: logoMap[brandSlug], slug: brandSlug });
  } else {
    // Try to find closest match
    const possibleMatches = Object.keys(logoMap).filter(fileSlug => 
      fileSlug.includes(brandSlug.slice(0, 5)) || brandSlug.includes(fileSlug.slice(0, 5))
    );
    
    mismatches.push({ 
      brand: brandName, 
      slug: brandSlug,
      possibleMatches: possibleMatches.map(s => logoMap[s])
    });
  }
});

console.log(`✅ ${matched.length} brands matched successfully`);
console.log(`❌ ${mismatches.length} brands NOT matched\n`);

if (mismatches.length > 0) {
  console.log('🔍 MISMATCHES (brand name → possible logo files):\n');
  mismatches.forEach(({ brand, slug, possibleMatches }) => {
    if (possibleMatches.length > 0) {
      console.log(`  "${brand}" (slug: ${slug})`);
      possibleMatches.forEach(file => console.log(`    → ${file}`));
    } else {
      console.log(`  "${brand}" (slug: ${slug}) → NO LOGO FILE FOUND`);
    }
  });
}

// Generate alias map
console.log('\n\n📝 SUGGESTED ALIAS MAP:\n');
console.log('const ALIAS_SLUG_MAP: Record<string, string> = {');

mismatches.forEach(({ brand, slug: brandSlug, possibleMatches }) => {
  if (possibleMatches.length > 0) {
    const bestMatch = possibleMatches[0].replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
    const targetSlug = slug(bestMatch);
    console.log(`  '${brandSlug}': '${targetSlug}', // ${brand} → ${bestMatch}`);
  }
});

console.log('};');
