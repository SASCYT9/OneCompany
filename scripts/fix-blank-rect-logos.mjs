#!/usr/bin/env node
/**
 * Restore originals from .bak then chroma-key the white background to
 * transparent. After this fix, INVERT_BRANDS_NORMALIZED rendering produces
 * a clean white silhouette of the dark logo content on the dark theme.
 */
import sharp from 'sharp';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOGOS = join(ROOT, 'public/logos');

const targets = [
  'onyx-concept.png',
  'fore-innovations.png',
  'bootmod3.webp',
];

for (const f of targets) {
  const inputPath = join(LOGOS, f);
  const backupPath = inputPath + '.bak';
  const tmpPath = inputPath + '.tmp3';

  if (existsSync(backupPath)) {
    copyFileSync(backupPath, inputPath);
    console.log(`Restored from .bak: ${f}`);
  }

  // Read raw, build alpha mask: white-ish pixels (>240 each) → transparent.
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    if (r > 240 && g > 240 && b > 240) {
      out[i + 3] = 0; // transparent
    } else {
      out[i + 3] = data[i + 3]; // keep
    }
  }

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(tmpPath);

  console.log(`Wrote tmp: ${tmpPath}`);
}

console.log('\nDone. Run swap-blank-rect-logos.ps1 next to replace originals.');
