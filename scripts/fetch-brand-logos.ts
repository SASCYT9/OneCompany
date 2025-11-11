/*
 High-quality brand logo fetcher
 - Tries Clearbit Logo API: https://logo.clearbit.com/<domain>
 - Fallback: Wikipedia brand logo via Wikipedia API + imageinfo
 - Saves PNG into public/logos/<slug>.png
 - Converts to PNG and pads to consistent height via sharp

 Notes:
 - Clearbit requires domain; we map known brands to domains. For others, we try brandname.com and fallback.
 - Wikipedia is best-effort (might return SVG which we rasterize via sharp if possible).
 - Rate-limited via p-limit.
*/

import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';
import pLimit from 'p-limit';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'logos');

// Minimal brand list gathered from auto/moto pages
import { allAutomotiveBrands, allMotoBrands } from '@/lib/brands';

const brands = [...new Set([...allAutomotiveBrands, ...allMotoBrands].map(b => b.name))];


// Known brand domains (best-effort; adjust as needed)
const brandDomains: Record<string, string | string[]> = {
  '1016 Industries': '1016industries.com',
  '1221 wheels': '1221wheels.com',
  '3D Design': '3ddesign.jp',
  'ADV.1 wheels': 'adv1wheels.com',
  'Airlift Performance': 'airliftperformance.com',
  'Alpha-N': 'alpha-n.de',
  'American Racing Headers': 'americanracingheaders.com',
  'AMS / Alpha Performance': 'amsperformance.com',
  'ARE dry sump': 'drysump.com',
  'Aston Martin': 'astonmartin.com',
  '5150 Autosport': '5150autosport.com',
  'ARMA Speed': 'armaspeed.com',
  'BBi Autosport': 'bbiautosport.com',
  'BC Racing': 'bcracing.com',
  'BE bearings': 'bebearings.com',
  'Bell Intercoolers': 'bellintercoolers.com',
  'BMC filters': 'bmcsairfilters.com',
  'Burger Motorsport': 'burgertuning.com',
  'CMST': 'cmsttuning.com',
  'Cobb tuning': 'cobbtuning.com',
  'CSF': 'csfrace.com',
  'do88': 'do88.com',
  'Dorch Engineering': 'dorchengineering.com',
  'Duke Dynamics': 'dukedynamics.com',
  'ESS Tuning': 'esstuning.com',
  'Eterna Motorworks': 'eternamotorworks.com',
  'Fall-Line Motorsports': 'falllinemotorsports.com',
  'Fore Innovations': 'foreinnovations.com',
  'Fragola Performance Systems': 'fragolaperformancesystems.com',
  'Future Design': 'futuredesigncarbon.com',
  'Gruppe-M': 'gruppemdirect.com',
  'Harrop': 'harrop-usa.com',
  'Injector Dynamics': 'injectordynamics.com',
  'IPe exhaust': 'ipeofficial.com',
  'JXB Performance': 'jxbperformance.com',
  'Killer B Motorsport': 'killerbmotorsport.com',
  'KLM Race': 'klmrace.com',
  'Kooks Headers': 'kooksheaders.com',
  'Lamspeed': 'lamspeedracing.com',
  'Liberty Walk': 'libertywalk.shop',
  'Link ECU': 'linkecu.com',
  'Lithiumax batteries': 'lithiumax.com.au',
  'LOBA Motorsport': 'loba-motorsport.com',
  'Lumma': 'lumma-design.com',
  'Mamba turbo': 'mambatek.com',
  'Manhart': 'manhart-performance.de',
  'Matt\'s carbon': 'matts.us',
  'MCA Suspension': 'mcasuspension.com',
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

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function fetchBuffer(url: string) {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 15000, validateStatus: () => true });
  if (res.status >= 200 && res.status < 300) return Buffer.from(res.data);
  throw new Error(`HTTP ${res.status} for ${url}`);
}

async function tryClearbit(name: string): Promise<Buffer | null> {
  const candidates = Array.isArray(brandDomains[name]) ? brandDomains[name] : [brandDomains[name]].filter(Boolean);
  candidates.push(`${slugify(name).replace(/-wheels| -exhaust/g, '')}.com`);
  for (const domain of candidates) {
    const url = `https://logo.clearbit.com/${domain}`;
    try {
      const buf = await fetchBuffer(url);
      if (buf && buf.length > 1000) return buf; // basic sanity check
    } catch {}
  }
  return null;
}

async function tryWikipedia(name: string): Promise<Buffer | null> {
  try {
    // Search the brand on Wikipedia
    const search = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', list: 'search', srsearch: name + ' brand logo', format: 'json', srlimit: 1, origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const page = search.data?.query?.search?.[0];
    if (!page) return null;

    // Get page images
    const images = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', prop: 'images', pageids: page.pageid, format: 'json', origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const imgs = images.data?.query?.pages?.[page.pageid]?.images || [];
    const logoFile = imgs.find((i: any) => /logo/i.test(i?.title || '')) || imgs[0];
    if (!logoFile) return null;

    // Get image URL
    const imageInfo = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: { action: 'query', titles: logoFile.title, prop: 'imageinfo', iiprop: 'url', format: 'json', origin: '*' },
      timeout: 15000,
      validateStatus: () => true,
    });
    const pages = imageInfo.data?.query?.pages;
    const firstKey = pages && Object.keys(pages)[0];
    const url = firstKey ? pages[firstKey]?.imageinfo?.[0]?.url : null;
    if (!url) return null;

    const buf = await fetchBuffer(url);
    return buf;
  } catch {
    return null;
  }
}

async function savePng(buf: Buffer, outPath: string) {
  // Convert to PNG, normalize height to ~80px while keeping aspect ratio
  const image = sharp(buf).resize({ height: 80, withoutEnlargement: true }).png({ quality: 90, compressionLevel: 9, adaptiveFiltering: true });
  const out = await image.toBuffer();
  await fs.writeFile(outPath, out);
}

async function processBrand(name: string) {
  const slug = slugify(name);
  const outPath = path.join(OUT_DIR, `${slug}.png`);

  // skip if exists
  try {
    await fs.access(outPath);
    return { name, status: 'skip-exists' } as const;
  } catch {}

  let buf: Buffer | null = null;

  // 1) Clearbit
  buf = await tryClearbit(name);
  // 2) Wikipedia fallback
  if (!buf) buf = await tryWikipedia(name);

  if (!buf) {
    return { name, status: 'failed' } as const;
  }

  await savePng(buf, outPath);
  return { name, status: 'ok' } as const;
}

async function main() {
  await ensureOutDir();
  const limit = pLimit(4);
  const jobs = brands.map((b) => limit(() => processBrand(b)));
  const results = await Promise.all(jobs);
  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Logo fetch summary:', summary);
  for (const r of results) console.log('-', r.name, r.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
