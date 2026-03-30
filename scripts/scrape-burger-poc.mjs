/**
 * Burger Motorsports Scraper — PoC (Proof of Concept)
 * 
 * Logic:
 * 1. Scrape all 748 products from Shopify API
 * 2. For each product, pick the RIGHT variant:
 *    - JB4 Tuners: pick JB4PRO variant (if exists), else best single-unit variant
 *    - Flex Fuel: pick "Complete Kit with Bluetooth ECA" (fullest BT kit)
 *    - Others: pick most expensive SIMPLE variant (no combo add-ons)
 * 3. Apply pricing: (Pro price × 1.10) + $30
 * 4. Tag by vehicle brand
 * 5. Output summary for validation
 */

const BASE_URL = 'https://burgertuning.com/products.json';
const MARKUP = 1.10;
const FLAT_FEE = 30;

// Patterns that indicate a variant is a bundle/combo (has add-on products bundled in)
const ADDON_PATTERNS = [
  /Add \d+cc .* Injectors/i,
  /Add a .*flex fuel/i,
  /Add the .* analyzer/i,
  /CANfuel Sequential Port/i,
  /\[\+\$/,                    // "[+$489]" style add-on pricing
  /Save \$/i,                 // "Save $100" = combo discount
];

// Patterns for the best tier
const PRO_PATTERNS = [/JB4\s*PRO/i, /JB4PRO/i];
const BT_PATTERNS = [/Bluetooth/i, /BlueTooth/i, /BT\b/];
const COMPLETE_KIT = /Complete Kit/i;
const FUEL_LINES_ONLY = /Fuel Lines? Only/i;

function isAddonCombo(variantTitle) {
  return ADDON_PATTERNS.some(p => p.test(variantTitle));
}

function isPro(variantTitle) {
  return PRO_PATTERNS.some(p => p.test(variantTitle));
}

function hasBluetooth(variantTitle) {
  return BT_PATTERNS.some(p => p.test(variantTitle));
}

function isCompleteKit(variantTitle) {
  return COMPLETE_KIT.test(variantTitle);
}

function isFuelLinesOnly(variantTitle) {
  return FUEL_LINES_ONLY.test(variantTitle);
}

/**
 * Pick the best variant for a product
 */
function pickBestVariant(product) {
  const variants = product.variants.filter(v => v.available !== false);
  if (variants.length === 0) return product.variants[0]; // fallback to first
  if (variants.length === 1) return variants[0];

  const type = product.product_type || '';

  // === JB4 Tuners: prefer PRO, exclude combos ===
  if (type === 'JB4 Tuners') {
    // First try: PRO variant without addon combos
    const proVariants = variants.filter(v => isPro(v.title) && !isAddonCombo(v.title));
    if (proVariants.length > 0) {
      return proVariants.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
    }
    // Fallback: most expensive non-combo variant
    const nonCombo = variants.filter(v => !isAddonCombo(v.title));
    if (nonCombo.length > 0) {
      return nonCombo.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
    }
  }

  // === Flex Fuel Kits: prefer Complete Kit with Bluetooth ===
  if (type === 'Flex Fuel Kits') {
    // Best: Complete Kit + Bluetooth
    const btComplete = variants.filter(v => isCompleteKit(v.title) && hasBluetooth(v.title) && !isFuelLinesOnly(v.title));
    if (btComplete.length > 0) {
      return btComplete.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
    }
    // Then: any Complete Kit
    const complete = variants.filter(v => isCompleteKit(v.title) && !isFuelLinesOnly(v.title));
    if (complete.length > 0) {
      return complete.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
    }
  }

  // === Port Injection: base kit without injector addons ===
  if (type === 'Port Injection & Manifolds') {
    const base = variants.filter(v => !isAddonCombo(v.title));
    if (base.length > 0) {
      return base.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
    }
  }

  // === Default: most expensive non-combo variant ===
  const nonCombo = variants.filter(v => !isAddonCombo(v.title));
  if (nonCombo.length > 0) {
    return nonCombo.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
  }

  // Absolute fallback
  return variants.reduce((a, b) => parseFloat(a.price) >= parseFloat(b.price) ? a : b);
}

/**
 * Detect vehicle brand from product collections, tags, and title
 */
function detectBrand(product) {
  const text = `${product.title} ${(product.tags || []).join(' ')}`.toLowerCase();
  
  const brands = [
    { name: 'BMW', patterns: [/\bbmw\b/, /\bn54\b/, /\bn55\b/, /\bb58\b/, /\bs58\b/, /\bs63\b/, /\bn63\b/, /\bn20\b/, /\bb48\b/, /\bm2\b/, /\bm3\b/, /\bm4\b/, /\bm5\b/, /\bm8\b/, /\bx3m\b/, /\bx4m\b/, /\bx5m\b/, /\bx6m\b/, /\be9[0-3]\b/, /\bf[0-9][0-9]\b/, /\bg[0-9][0-9]\b/] },
    { name: 'Mercedes', patterns: [/\bmercedes\b/, /\bamg\b/, /\bm177\b/, /\bm133\b/, /\bm274\b/, /\bm276\b/] },
    { name: 'Porsche', patterns: [/\bporsche\b/, /\b911\b/, /\bcayman\b/, /\bmacan\b/, /\bcayenne\b/] },
    { name: 'Audi', patterns: [/\baudi\b/, /\brs[3-7]\b/, /\brsq\d/] },
    { name: 'VW', patterns: [/\bvolkswagen\b/, /\bvw\b/, /\bgti\b/, /\bgolf r\b/] },
    { name: 'Toyota', patterns: [/\btoyota\b/, /\bsupra\b/, /\bgr\s/] },
    { name: 'Kia', patterns: [/\bkia\b/, /\bstinger\b/] },
    { name: 'Hyundai', patterns: [/\bhyundai\b/, /\bgenesis\b/, /\bveloster\b/] },
    { name: 'Infiniti', patterns: [/\binfiniti\b/, /\bq50\b/, /\bq60\b/] },
    { name: 'Nissan', patterns: [/\bnissan\b/, /\bgtr\b/, /\b370z\b/, /\b400z\b/] },
    { name: 'Dodge', patterns: [/\bdodge\b/, /\bcharger\b/, /\bchallenger\b/] },
    { name: 'Ford', patterns: [/\bford\b/, /\bmustang\b/, /\bbronco\b/, /\bf-?150\b/] },
    { name: 'Tesla', patterns: [/\btesla\b/, /\bmodel [3sy]\b/] },
    { name: 'Mini', patterns: [/\bmini\b/, /\bjcw\b/] },
    { name: 'Subaru', patterns: [/\bsubaru\b/, /\bwrx\b/, /\bbrz\b/] },
    { name: 'Honda', patterns: [/\bhonda\b/, /\bcivic\b/, /\baccord\b/] },
    { name: 'McLaren', patterns: [/\bmcl?aren\b/] },
    { name: 'Maserati', patterns: [/\bmaserati\b/, /\bghibli\b/] },
    { name: 'Alfa Romeo', patterns: [/\balfa\b/, /\bgiulia\b/, /\bstelvio\b/] },
    { name: 'Lexus', patterns: [/\blexus\b/, /\bis\s?300\b/, /\bis\s?500\b/] },
    { name: 'Range Rover', patterns: [/\brange rover\b/, /\bland rover\b/, /\bdefender\b/] },
    { name: 'Chevrolet', patterns: [/\bchevrolet\b/, /\bcamaro\b/, /\bcorvette\b/] },
    { name: 'Volvo', patterns: [/\bvolvo\b/] },
    { name: 'Lotus', patterns: [/\blotus\b/, /\bemira\b/] },
    { name: 'Mazda', patterns: [/\bmazda\b/, /\bcx-?[59]0?\b/] },
    { name: 'Jeep', patterns: [/\bjeep\b/, /\bwrangler\b/] },
    { name: 'RAM', patterns: [/\bram\b/, /\b1500\b/] },
    { name: 'Aston Martin', patterns: [/\baston\b/] },
    { name: 'Cadillac', patterns: [/\bcadillac\b/, /\bct[45]\b/] },
    { name: 'Acura', patterns: [/\bacura\b/, /\bintegra\b/, /\btlx\b/] },
    { name: 'Fiat', patterns: [/\bfiat\b/, /\babarth\b/] },
  ];

  const found = [];
  for (const brand of brands) {
    if (brand.patterns.some(p => p.test(text))) {
      found.push(brand.name);
    }
  }
  return found.length > 0 ? found : ['Universal'];
}

function applyPricing(originalUsd) {
  return Math.round((originalUsd * MARKUP + FLAT_FEE) * 100) / 100;
}

async function scrape() {
  console.log('🍔 Scraping Burger Motorsports...\n');
  
  let allProducts = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${BASE_URL}?limit=250&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.products.length === 0) break;
    allProducts = allProducts.concat(data.products);
    console.log(`  Page ${page}: ${data.products.length} products`);
  }
  
  console.log(`\nTotal scraped: ${allProducts.length}\n`);
  
  // Process each product
  const results = [];
  const issues = [];
  
  for (const product of allProducts) {
    const bestVariant = pickBestVariant(product);
    const originalPrice = parseFloat(bestVariant.price);
    const ourPrice = applyPricing(originalPrice);
    const brands = detectBrand(product);
    
    const result = {
      title: product.title,
      slug: product.handle,
      type: product.product_type,
      brands,
      originalPriceUsd: originalPrice,
      ourPriceUsd: ourPrice,
      selectedVariant: bestVariant.title,
      totalVariants: product.variants.length,
      hasImage: product.images.length > 0,
      hasSale: bestVariant.compare_at_price != null,
    };
    
    results.push(result);
    
    // Flag issues
    if (originalPrice === 0) issues.push(`ZERO PRICE: ${product.title}`);
    if (!result.hasImage) issues.push(`NO IMAGE: ${product.title}`);
    if (brands[0] === 'Universal' && product.product_type !== 'Universal Products') {
      issues.push(`UNTAGGED BRAND: ${product.title} (type: ${product.product_type})`);
    }
  }
  
  // === Summary ===
  console.log('═══════════════════════════════════════════');
  console.log('        PRICING VALIDATION SAMPLES');
  console.log('═══════════════════════════════════════════\n');
  
  // Show 15 diverse samples
  const samples = [];
  const seenTypes = new Set();
  for (const r of results) {
    if (!seenTypes.has(r.type) && samples.length < 15) {
      seenTypes.add(r.type);
      samples.push(r);
    }
  }
  
  for (const s of samples) {
    console.log(`📦 ${s.title}`);
    console.log(`   Type: ${s.type} | Brand: ${s.brands.join(', ')}`);
    console.log(`   Variant: "${s.selectedVariant}" (of ${s.totalVariants})`);
    console.log(`   Original: $${s.originalPriceUsd} → Our: $${s.ourPriceUsd}`);
    console.log(`   Formula: ($${s.originalPriceUsd} × ${MARKUP}) + $${FLAT_FEE} = $${s.ourPriceUsd}`);
    console.log('');
  }
  
  // Brand distribution
  console.log('═══════════════════════════════════════════');
  console.log('        BRAND DISTRIBUTION');
  console.log('═══════════════════════════════════════════\n');
  
  const brandCounts = {};
  for (const r of results) {
    for (const b of r.brands) {
      brandCounts[b] = (brandCounts[b] || 0) + 1;
    }
  }
  Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => console.log(`  ${brand}: ${count}`));
  
  // Product type distribution
  console.log('\n═══════════════════════════════════════════');
  console.log('        PRODUCT TYPE DISTRIBUTION');
  console.log('═══════════════════════════════════════════\n');
  
  const typeCounts = {};
  for (const r of results) {
    typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
  }
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${type}: ${count}`));
  
  // Price range
  const prices = results.map(r => r.ourPriceUsd);
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Price range: $${Math.min(...prices)} — $${Math.max(...prices)}`);
  console.log(`  Average: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`);
  console.log(`  Products with sale price (ignored): ${results.filter(r => r.hasSale).length}`);
  console.log(`  Products without image: ${results.filter(r => !r.hasImage).length}`);
  console.log(`═══════════════════════════════════════════`);
  
  // Issues
  if (issues.length > 0) {
    console.log(`\n⚠️  ISSUES (${issues.length}):`);
    issues.slice(0, 20).forEach(i => console.log(`  ${i}`));
    if (issues.length > 20) console.log(`  ... and ${issues.length - 20} more`);
  }
  
  console.log(`\n✅ Done! ${results.length} products processed.`);
}

scrape().catch(console.error);
