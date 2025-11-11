/*
 High-quality brand logo fetcher
 - Tries Clearbit Logo API: https://logo.clearbit.com/<domain>
 - Fallback: Wikipedia brand logo via Wikipedia API + imageinfo
 - Saves PNG into public/logos/<slug>.png
 - Converts to PNG and pads to consistent height via sharp
*/

const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const sharp = require('sharp');
const pLimit = require('p-limit');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'logos');

const { allAutomotiveBrands, allMotoBrands } = require('../lib/brands.ts');

const brands = [...new Set([...allAutomotiveBrands, ...allMotoBrands].map(b => b.name))];

const brandDomains = {
  'Akrapovič': 'akrapovic.com',
  'BBS': 'bbs.com',
  'Brembo': 'brembo.com',
  'Capristo': 'capristo.de',
  'Eventuri': 'eventuri.net',
  'Fi Exhaust': 'fi-exhaust.com',
  'Forge Motorsport': 'forgemotorsport.co.uk',
  'H&R': 'h-r.com',
  'HRE Wheels': 'hrewheels.com',
  'KW Suspension': ['kwsuspensions.net', 'kw-suspensions.eu', 'kwautomotive.com'],
  'Milltek': 'millteksport.com',
  'Ohlins': 'ohlins.com',
  'Recaro': 'recaro-automotive.com',
  'Rotiform': 'rotiform.com',
  'Vossen': 'vossenwheels.com',
  'Alpinestars': 'alpinestars.com',
  'Arai': 'araihelmet.eu',
  'Dainese': 'dainese.com',
  'Givi': 'givi.it',
  'Rizoma': 'rizoma.com',
  'Scorpion': 'scorpion-exhausts.com',
  'Shoei': 'shoei-europe.com',
  'Termignoni': 'termignoni.it',
  'Yoshimura': 'yoshimura-rd.com',
};

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function fetchBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, validateStatus: () => true });
  if (res.status >= 200 && res.status < 300) return Buffer.from(res.data);
  throw new Error(`HTTP ${res.status} for ${url}`);
}

async function tryClearbit(name) {
  const candidates = Array.isArray(brandDomains[name]) ? brandDomains[name] : [brandDomains[name]].filter(Boolean);
  candidates.push(`${slugify(name).replace(/-wheels| -exhaust/g, '')}.com`);
  for (const domain of candidates) {
    const url = `https://logo.clearbit.com/${domain}`;
    try {
      const buf = await fetchBuffer(url);
      if (buf && buf.length > 1000) return buf;
    } catch {}
  }
  return null;
}

async function tryWikipedia(name) {
  try {
    const search = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', list: 'search', srsearch: name + ' brand logo', format: 'json', srlimit: 1, origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const page = search.data?.query?.search?.[0];
    if (!page) return null;

    const images = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', prop: 'images', pageids: page.pageid, format: 'json', origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const imgs = images.data?.query?.pages?.[page.pageid]?.images || [];
    const logoFile = imgs.find((i) => /logo/i.test(i?.title || '')) || imgs[0];
    if (!logoFile) return null;

    const imageInfo = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', titles: logoFile.title, prop: 'imageinfo', iiprop: 'url', format: 'json', origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const pages = imageInfo.data?.query?.pages;
    const firstKey = pages && Object.keys(pages)[0];
    const url = firstKey ? pages[firstKey]?.imageinfo?.[0]?.url : null;
    if (!url) return null;

    return await fetchBuffer(url);
  } catch {
    return null;
  }
}

async function savePng(buf, outPath) {
  const image = sharp(buf).resize({ height: 80, withoutEnlargement: true }).png({ quality: 90, compressionLevel: 9, adaptiveFiltering: true });
  const out = await image.toBuffer();
  await fs.writeFile(outPath, out);
}

async function processBrand(name) {
  const slug = slugify(name);
  const outPath = path.join(OUT_DIR, `${slug}.png`);

  try {
    await fs.access(outPath);
    return { name, status: 'skip-exists' };
  } catch {}

  let buf = await tryClearbit(name);
  if (!buf) buf = await tryWikipedia(name);

  if (!buf) {
    return { name, status: 'failed' };
  }

  await savePng(buf, outPath);
  return { name, status: 'ok' };
}

async function main() {
  await ensureOutDir();
  const limit = pLimit(4);
  const jobs = brands.map((b) => limit(() => processBrand(b)));
  const results = await Promise.all(jobs);
  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Logo fetch summary:', summary);
  for (const r of results) console.log('-', r.name, r.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
