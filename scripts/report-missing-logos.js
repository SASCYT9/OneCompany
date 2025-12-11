/**
 * Report missing brand logos with website and existing tiny files.
 *
 * Run:
 *   node scripts/report-missing-logos.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');
const BRANDS_FILE = path.join(PROJECT_DIR, 'src', 'lib', 'brands.ts');
const LOGOS_DIR = path.join(PROJECT_DIR, 'public', 'logos');

const MIN_BYTES = 500;

// Keep the same overrides as scripts/generate-brand-logos-map.js
const NAME_TO_SLUG_OVERRIDES = {
  'ABT': 'abt',
  'AC Schnitzer': 'ac-schnitzer',
  'AMS / Alpha Performance': 'ams-alpha-performance',
  'H&R': 'handr',
  'KW': 'kw',
  'Öhlins': 'ohlins',
  '3D Design': '3d-design',
  'FI Exhaust': 'fi-exhaust',
  'IPe exhaust': 'ipe-exhaust',
  'Akrapovič': 'akrapovic',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/ö/g, 'o')
    .replace(/č/g, 'c')
    .replace(/[&]/g, 'and')
    .replace(/[']/g, '')
    .replace(/[\/]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function brandNameToSlug(name) {
  return NAME_TO_SLUG_OVERRIDES[name] || slugify(name);
}

function unescapeTsString(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function loadBrands() {
  const content = fs.readFileSync(BRANDS_FILE, 'utf8');

  const brands = [];

  // Match name: '...' or name: "..." and website: similarly; allow escaped quotes.
  const re = /name:\s*(?:'((?:\\.|[^'])*)'|\"((?:\\.|[^\"])*)\").*?website:\s*(?:'((?:\\.|[^'])*)'|\"((?:\\.|[^\"])*)\")/gs;

  for (const m of content.matchAll(re)) {
    const rawName = (m[1] || m[2] || '').trim();
    const rawWebsite = (m[3] || m[4] || '').trim();
    if (!rawName || !rawWebsite) continue;

    const name = unescapeTsString(rawName);
    const website = unescapeTsString(rawWebsite);

    if (!brands.some((b) => b.name === name)) {
      brands.push({ name, website });
    }
  }

  return brands;
}

function findLogoFilesForSlug(slug) {
  const exts = ['.svg', '.webp', '.png', '.jpg', '.jpeg', '.gif'];
  const found = [];
  for (const ext of exts) {
    const p = path.join(LOGOS_DIR, slug + ext);
    if (fs.existsSync(p)) {
      const st = fs.statSync(p);
      if (st.isFile()) {
        found.push({ file: path.basename(p), size: st.size });
      }
    }
  }
  return found;
}

function main() {
  const brands = loadBrands();

  const missing = [];
  for (const b of brands) {
    const slug = brandNameToSlug(b.name);
    const files = findLogoFilesForSlug(slug);
    const ok = files.some((f) => f.size >= MIN_BYTES);
    if (!ok) {
      missing.push({
        name: b.name,
        slug,
        website: b.website,
        files,
      });
    }
  }

  missing.sort((a, b) => a.slug.localeCompare(b.slug));

  console.log(`Missing logos: ${missing.length}`);
  console.log('='.repeat(80));

  for (const m of missing) {
    const note = m.files.length
      ? `existing: ${m.files.map((f) => `${f.file} (${f.size}b)`).join(', ')}`
      : 'no local file';
    console.log(`${m.name} | ${m.slug} | ${m.website} | ${note}`);
  }
}

main();
