// Fetch brand logos via Brandfetch API and save to public/logos
// Usage (PowerShell): $env:BRANDFETCH_API_KEY="<key>"; node scripts/fetch-brand-logos.js

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const fetch = require('node-fetch');

const API_KEY = process.env.BRANDFETCH_API_KEY;
if (!API_KEY) {
  console.error('Missing BRANDFETCH_API_KEY environment variable.');
  process.exit(1);
}

const brands = [
  { name: 'Akrapovič' },
  { name: 'BBS' },
  { name: 'Brembo' },
  { name: 'Capristo' },
  { name: 'Eventuri' },
  { name: 'Fi Exhaust' },
  { name: 'Forge Motorsport' },
  { name: 'H&R' },
  { name: 'HRE Wheels' },
  { name: 'KW Suspension' },
  { name: 'Milltek' },
  { name: 'Ohlins' },
  { name: 'Recaro' },
  { name: 'Rotiform' },
  { name: 'Vossen' }
];

const preferredDomains = {
  'Akrapovič': 'akrapovic.com',
  'BBS': 'bbs.de',
  'Brembo': 'brembo.com',
  'Capristo': 'capristo.de',
  'Eventuri': 'eventuri.net',
  'Fi Exhaust': 'fi-exhaust.com',
  'Forge Motorsport': 'forgemotorsport.co.uk',
  'H&R': 'h-r.com',
  'HRE Wheels': 'hrewheels.com',
  'KW Suspension': 'kwsuspensions.com',
  'Milltek': 'millteksport.com',
  'Ohlins': 'ohlins.com',
  'Recaro': 'recaro-automotive.com',
  'Rotiform': 'rotiform.com',
  'Vossen': 'vossenwheels.com'
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const logosDir = path.join(process.cwd(), 'public', 'logos');

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensureDir() {
  if (!fs.existsSync(logosDir)) {
    await fsp.mkdir(logosDir, { recursive: true });
  }
}

async function brandfetchSearch(query) {
  const res = await fetch('https://api.brandfetch.io/v2/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

async function getBrandByDomain(domain) {
  const res = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  if (!res.ok) throw new Error(`Brand fetch failed: ${res.status}`);
  return res.json();
}

function pickBestLogo(brandData) {
  if (!brandData || !Array.isArray(brandData.logos)) return null;
  // Prefer type 'logo' then 'symbol', prefer svg format
  let candidates = brandData.logos.filter(l => l.type === 'logo');
  if (candidates.length === 0) candidates = brandData.logos;
  for (const logo of candidates) {
    if (Array.isArray(logo.formats)) {
      const svg = logo.formats.find(f => f.format === 'svg');
      if (svg) return svg.src;
    }
  }
  // fallback to first format
  for (const logo of candidates) {
    if (Array.isArray(logo.formats) && logo.formats[0]) return logo.formats[0].src;
  }
  return null;
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  await fsp.writeFile(destPath, Buffer.from(arrayBuffer));
}

async function processBrand(name) {
  const slug = slugify(name);
  const outSvg = path.join(logosDir, `${slug}.svg`);
  const outPng = path.join(logosDir, `${slug}.png`);

  try {
    const domain = preferredDomains[name];
    let brandData = null;
    if (domain) {
      try {
        brandData = await getBrandByDomain(domain);
      } catch (_) {
        // fallback to search
      }
    }
    if (!brandData) {
      const results = await brandfetchSearch(name);
      if (Array.isArray(results) && results[0] && results[0].domain) {
        brandData = await getBrandByDomain(results[0].domain);
      } else {
        throw new Error('No search results');
      }
    }

    const logoUrl = pickBestLogo(brandData);
    if (!logoUrl) throw new Error('No logo URL');

    const isSvg = logoUrl.toLowerCase().endsWith('.svg');
    // If file exists already with old slug (e.g., akrapovi.png) rename to new slug for consistency
    const legacyPattern = new RegExp(`^${slug.replace(/-.*/, '')}.*\\.(svg|png)$`); // coarse prefix check
    const existingFiles = await fsp.readdir(logosDir);
    for (const file of existingFiles) {
      if (!file.startsWith(slug) && legacyPattern.test(file) && !file.startsWith(slug)) {
        const ext = path.extname(file);
        const newName = `${slug}${ext}`;
        try {
          await fsp.rename(path.join(logosDir, file), path.join(logosDir, newName));
          console.log(`↺ Renamed legacy ${file} -> ${newName}`);
        } catch (_) {}
      }
    }
    await downloadToFile(logoUrl, isSvg ? outSvg : outPng);
    console.log(`✔ Saved ${name} -> ${path.basename(isSvg ? outSvg : outPng)}`);
  } catch (e) {
    console.warn(`✖ ${name}: ${e.message}`);
  }
}

(async () => {
  await ensureDir();
  for (const b of brands) {
    await processBrand(b.name);
    await delay(400); // gentle pace to avoid rate-limits
  }
})();
