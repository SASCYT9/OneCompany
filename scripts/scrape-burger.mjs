/**
 * Burger Motorsports Full Scraper
 * 
 * Scrapes all products from burgertuning.com Shopify API
 * Applies: variant selection (PRO/BT), pricing formula, brand tagging, filtering
 * Outputs: data/burger-products.json ready for DB import
 */

const MARKUP = 1.10;
const FLAT_FEE = 30;

// ── Exclusion: non-automotive items ──
const EXCLUDE_TITLE = [
  /Official.*Clothing/i, /Keychain/i, /Towel/i, /Banner/i,
  /Sticker/i, /Decal/i, /\bHat\b/i, /Flexfit/i, /Emblem.*Badge/i,
  /CARB Sticker/i, /Core Deposit/i,
  /^Add /i, /^Choose /i, /^Include /i, /^Upgrade /i,
  /^Optional /i, /^Options$/i, /^Do you need/i,
  /per Foot$/i, /FSB for JB4/i,
  /Phone Mount/i, /Cell Phone/i, /Faraday/i,
  /Logo Sticker Sheet/i, /\*\*Out of stock\*\*/i,
];

// ── Combo/addon bundle detection ──
const ADDON_PATTERNS = [
  /Add \d+cc .* Injectors/i,
  /Add a .*flex fuel/i,
  /Add the .* analyzer/i,
  /CANfuel Sequential Port/i,
  /\[\+\$/,
  /Save \$/i,
];

// ── Variant selection patterns ──
const PRO_PATTERNS = [/JB4\s*PRO/i, /JB4PRO/i];
const BT_PATTERNS = [/Bluetooth/i, /BlueTooth/i];
const COMPLETE_KIT = /Complete Kit/i;
const FUEL_LINES_ONLY = /Fuel Lines? Only/i;

function isAddonCombo(title) { return ADDON_PATTERNS.some(p => p.test(title)); }
function isPro(title) { return PRO_PATTERNS.some(p => p.test(title)); }
function hasBluetooth(title) { return BT_PATTERNS.some(p => p.test(title)); }

function pickBestVariant(product) {
  const variants = product.variants.filter(v => v.available !== false);
  if (variants.length === 0) return product.variants[0];
  if (variants.length === 1) return variants[0];

  const type = product.product_type || '';

  // JB4: prefer PRO, exclude combos
  if (type === 'JB4 Tuners') {
    const pro = variants.filter(v => isPro(v.title) && !isAddonCombo(v.title));
    if (pro.length > 0) return pro.reduce((a, b) => +a.price >= +b.price ? a : b);
    const base = variants.filter(v => !isAddonCombo(v.title));
    if (base.length > 0) return base.reduce((a, b) => +a.price >= +b.price ? a : b);
  }

  // Flex Fuel: Complete Kit with Bluetooth
  if (type === 'Flex Fuel Kits') {
    const btKit = variants.filter(v => COMPLETE_KIT.test(v.title) && hasBluetooth(v.title) && !FUEL_LINES_ONLY.test(v.title));
    if (btKit.length > 0) return btKit.reduce((a, b) => +a.price >= +b.price ? a : b);
    const kit = variants.filter(v => COMPLETE_KIT.test(v.title) && !FUEL_LINES_ONLY.test(v.title));
    if (kit.length > 0) return kit.reduce((a, b) => +a.price >= +b.price ? a : b);
  }

  // Port Injection: base without injector addons
  if (type === 'Port Injection & Manifolds') {
    const base = variants.filter(v => !isAddonCombo(v.title));
    if (base.length > 0) return base.reduce((a, b) => +a.price >= +b.price ? a : b);
  }

  // Default: most expensive non-combo
  const nonCombo = variants.filter(v => !isAddonCombo(v.title));
  if (nonCombo.length > 0) return nonCombo.reduce((a, b) => +a.price >= +b.price ? a : b);
  return variants.reduce((a, b) => +a.price >= +b.price ? a : b);
}

// ── Brand detection ──
const BRANDS = [
  { name: 'BMW', patterns: [/\bbmw\b/i, /\bn54\b/i, /\bn55\b/i, /\bb58\b/i, /\bs58\b/i, /\bs63\b/i, /\bn63\b/i, /\bn20\b/i, /\bb48\b/i, /\bb46\b/i, /\bb36\b/i, /\bs68\b/i, /\bn52\b/i, /\bn62\b/i, /\bs55\b/i, /\bm2\b/i, /\bm3\b/i, /\bm4\b/i, /\bm5\b/i, /\bm6\b/i, /\bm8\b/i, /\bx3m\b/i, /\bx4m\b/i, /\bx5m\b/i, /\bx6m\b/i, /\be[0-9][0-9]\b/i, /\bf[0-9][0-9]\b/i, /\bg[0-9][0-9]x?\b/i] },
  { name: 'Toyota', patterns: [/\btoyota\b/i, /\bsupra\b/i, /\bgr\s/i, /\bgr86\b/i] },
  { name: 'Mercedes', patterns: [/\bmercedes\b/i, /\bamg\b/i, /\bm177\b/i, /\bm133\b/i, /\bm274\b/i, /\bm276\b/i, /\bc63\b/i, /\bc43\b/i, /\ba45\b/i, /\bcla\b/i, /\bgla\b/i, /\bgle\b/i, /\bg63\b/i, /\bw205\b/i, /\bw213\b/i] },
  { name: 'Porsche', patterns: [/\bporsche\b/i, /\b911\b/i, /\bcayman\b/i, /\bmacan\b/i, /\bcayenne\b/i, /\bpanamera\b/i, /\bboxster\b/i, /\btaycan\b/i] },
  { name: 'Audi', patterns: [/\baudi\b/i, /\brs[3-7]\b/i, /\brsq\d/i, /\bttrs\b/i] },
  { name: 'VW', patterns: [/\bvolkswagen\b/i, /\bvw\b/i, /\bgti\b/i, /\bgolf\s?r\b/i, /\bea888\b/i] },
  { name: 'Kia', patterns: [/\bkia\b/i, /\bstinger\b/i] },
  { name: 'Hyundai', patterns: [/\bhyundai\b/i, /\bgenesis\b/i, /\bveloster\b/i] },
  { name: 'Infiniti', patterns: [/\binfiniti\b/i, /\bq50\b/i, /\bq60\b/i] },
  { name: 'Nissan', patterns: [/\bnissan\b/i, /\bgtr\b/i, /\b370z\b/i, /\b400z\b/i] },
  { name: 'Ford', patterns: [/\bford\b/i, /\bmustang\b/i, /\bbronco\b/i, /\bf-?150\b/i, /\braptor\b/i, /\becoboost\b/i] },
  { name: 'Dodge', patterns: [/\bdodge\b/i, /\bcharger\b/i, /\bchallenger\b/i, /\bhellcat\b/i, /\bscat\s?pack\b/i] },
  { name: 'Tesla', patterns: [/\btesla\b/i, /\bmodel\s?[3sy]\b/i] },
  { name: 'Mini', patterns: [/\bmini\b/i, /\bjcw\b/i] },
  { name: 'Subaru', patterns: [/\bsubaru\b/i, /\bwrx\b/i, /\bbrz\b/i, /\bfa20\b/i] },
  { name: 'Honda', patterns: [/\bhonda\b/i, /\bcivic\b/i, /\baccord\b/i, /\btype[\s-]?r\b/i] },
  { name: 'McLaren', patterns: [/\bmclaren\b/i] },
  { name: 'Maserati', patterns: [/\bmaserati\b/i, /\bghibli\b/i] },
  { name: 'Alfa Romeo', patterns: [/\balfa\b/i, /\bgiulia\b/i, /\bstelvio\b/i] },
  { name: 'Lexus', patterns: [/\blexus\b/i, /\bis\s?[35]00\b/i, /\brc\s?f?\b/i] },
  { name: 'Range Rover', patterns: [/\brange\s?rover\b/i, /\bland\s?rover\b/i, /\bdefender\b/i] },
  { name: 'Chevrolet', patterns: [/\bchev(rolet)?\b/i, /\bcamaro\b/i, /\bcorvette\b/i, /\bgmc\b/i, /\bbuick\b/i, /\bsilverado\b/i] },
  { name: 'Volvo', patterns: [/\bvolvo\b/i] },
  { name: 'Lotus', patterns: [/\blotus\b/i, /\bemira\b/i] },
  { name: 'Mazda', patterns: [/\bmazda\b/i, /\bcx-?\d+\b/i, /\bmiata\b/i] },
  { name: 'Jeep', patterns: [/\bjeep\b/i, /\bwrangler\b/i] },
  { name: 'RAM', patterns: [/\bram\b/i, /\bhemi\b/i] },
  { name: 'Aston Martin', patterns: [/\baston\b/i] },
  { name: 'Cadillac', patterns: [/\bcadillac\b/i, /\bct[45]-?v?\b/i] },
  { name: 'Acura', patterns: [/\bacura\b/i, /\bintegra\b/i, /\btlx\b/i] },
  { name: 'Fiat', patterns: [/\bfiat\b/i, /\babarth\b/i] },
];

function detectBrands(product) {
  const text = `${product.title} ${(product.tags || []).join(' ')} ${product.product_type || ''}`.toLowerCase();
  const found = BRANDS.filter(b => b.patterns.some(p => p.test(text))).map(b => b.name);
  return found.length > 0 ? found : ['Universal'];
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyPricing(usd) {
  return Math.round((usd * MARKUP + FLAT_FEE) * 100) / 100;
}

// ── Map product type to a category slug ──
const TYPE_TO_CATEGORY = {
  'JB4 Tuners': 'jb4-tuners',
  'JB+ Tuners': 'jb-plus-tuners',
  'Stage 1 Tuners': 'stage-1-tuners',
  'Flex Fuel Kits': 'flex-fuel',
  'Intakes': 'intakes',
  'Oil Catch Cans': 'oil-catch-cans',
  'Wheel Spacers & Accessories': 'wheel-spacers',
  'Methanol Injection': 'methanol-injection',
  'Fuel Pumps': 'fuel-pumps',
  'Port Injection & Manifolds': 'port-injection',
  'Charge Pipes': 'charge-pipes',
  'Air Filters': 'air-filters',
  'Engine Accessories': 'engine-accessories',
  'Blow Off Valves & Adapters': 'blow-off-valves',
  'Spark Plugs & Accessories': 'spark-plugs',
  'Cooling & Heat Shields': 'cooling',
  'Sensors': 'sensors',
  'Exhaust Tips': 'exhaust-tips',
  'Strut Braces': 'strut-braces',
  'Turbo Inlets & Turbo Accessories': 'turbo-accessories',
  'OBDII Dongles & Accessories': 'obdii-accessories',
  'Chassis Reinforcement & Accessories': 'chassis-reinforcement',
  'Transmission Coolers': 'transmission-coolers',
  'Clutch Stops': 'clutch-stops',
  'Billet Accessories': 'billet-accessories',
  'Pedal Tuners': 'pedal-tuners',
  'Dragy & Dragy Accessories': 'dragy',
  'Universal Products': 'universal',
};

// ──────────────────────────────────────────
async function main() {
  console.log('🍔 Scraping Burger Motorsports full catalog...\n');

  // 1. Fetch all pages
  let allProducts = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://burgertuning.com/products.json?limit=250&page=${page}`);
    const data = await res.json();
    if (data.products.length === 0) break;
    allProducts = allProducts.concat(data.products);
    process.stdout.write(`  Page ${page}: ${data.products.length} products\n`);
  }
  console.log(`  Total fetched: ${allProducts.length}\n`);

  // 2. Filter out non-automotive
  const automotive = allProducts.filter(p => !EXCLUDE_TITLE.some(rx => rx.test(p.title)));
  console.log(`  After filter: ${automotive.length} automotive products\n`);

  // 3. Process
  const products = automotive.map(p => {
    const variant = pickBestVariant(p);
    const originalUsd = parseFloat(variant.price);
    const ourUsd = applyPricing(originalUsd);
    const brands = detectBrands(p);
    const categorySlug = TYPE_TO_CATEGORY[p.product_type] || 'universal';

    // Build tags
    const tags = [
      ...brands.map(b => `brand:${b}`),
      `type:${categorySlug}`,
      `vendor:burger-motorsports`,
    ];

    // Media URLs
    const media = (p.images || []).map((img, i) => ({
      url: img.src,
      alt: img.alt || p.title,
      position: i,
      width: img.width,
      height: img.height,
    }));

    const isJb4 = ['jb4-tuners', 'jb-plus-tuners', 'stage-1-tuners'].includes(categorySlug);

    return {
      title: p.title,
      slug: p.handle,
      sku: variant.sku || `BURGER-${p.id}`,
      descriptionEn: stripHtml(p.body_html),
      descriptionUa: '', // translate later
      brand: 'Burger Motorsports',
      vendor: p.vendor || 'Burger Motorsports Inc',
      productType: p.product_type,
      categorySlug,
      tags,
      brands,
      priceUsd: isJb4 ? ourUsd : null, // Show calculated price ONLY for JB4, others return null (Price on Request)
      originalPriceUsd: originalUsd, // Safely stored for admin purposes
      selectedVariant: variant.title,
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
      weight: variant.grams || 0,
      media,
      shopifyProductId: p.id,
      shopifyVariantId: variant.id,
      available: variant.available !== false,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });

  // 4. Save
  const fs = await import('fs');
  const outPath = new URL('../data/burger-products.json', import.meta.url);
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2));
  console.log(`\n✅ Saved ${products.length} products to data/burger-products.json`);

  // Stats
  const brandCounts = {};
  products.forEach(p => p.brands.forEach(b => { brandCounts[b] = (brandCounts[b] || 0) + 1; }));
  console.log('\nBrand distribution:');
  Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).forEach(([b, c]) => console.log(`  ${b}: ${c}`));

  const prices = products.map(p => p.priceUsd);
  console.log(`\nPrice range: $${Math.min(...prices).toFixed(2)} — $${Math.max(...prices).toFixed(2)}`);
  console.log(`Average: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`);
  console.log(`Without images: ${products.filter(p => p.media.length === 0).length}`);
}

main().catch(console.error);
