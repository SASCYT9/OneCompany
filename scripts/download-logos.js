import fetch from 'node-fetch';
import fs from 'fs/promises';

// List of brand names from your project (add more as needed)
const brands = [
  'Akrapovič',
  'BBS',
  'Brembo',
  'Capristo',
  'Eventuri',
  'Fi Exhaust',
  'Forge Motorsport',
  'H&R',
  'HRE Wheels',
  'KW Suspension',
  'Milltek',
  'Ohlins',
  'Recaro',
  'Rotiform',
  'Vossen',
];

const sanitize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '-');

async function downloadLogo(brand) {
  const query = encodeURIComponent(brand);
  const url = `https://worldvectorlogo.com/api/v1/search?q=${query}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data || !data.logos || !data.logos.length) {
    console.log(`No logo found for ${brand}`);
    return;
  }
  const logoUrl = data.logos[0].file;
  const logoRes = await fetch(logoUrl);
  const buffer = await logoRes.arrayBuffer();
  const fileName = `public/logos/${sanitize(brand)}.svg`;
  await fs.writeFile(fileName, Buffer.from(buffer));
  console.log(`Downloaded logo for ${brand}`);
}

(async () => {
  await fs.mkdir('public/logos', { recursive: true });
  for (const brand of brands) {
    try {
      await downloadLogo(brand);
    } catch (e) {
      console.error(`Error for ${brand}:`, e);
    }
  }
})();
