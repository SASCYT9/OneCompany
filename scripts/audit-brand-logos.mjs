#!/usr/bin/env node
/**
 * Audit every file in public/logos/ for visual issues that hurt brand cards/modals:
 *   - opaque white/light background (causes "white-square" cards)
 *   - logo too dark (likely invisible on the dark site theme without invert)
 *   - missing alpha channel where transparency is expected
 *   - JPEG/low-quality artifacts (blocky compression, low resolution)
 *   - tiny dimensions (will pixelate when scaled)
 *   - non-square or unusually narrow/wide aspect ratios
 *
 * Usage:  node scripts/audit-brand-logos.mjs [--json]
 */

import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGOS_DIR = resolve(__dirname, '..', 'public', 'logos');
const SUPPORTED = new Set(['.png', '.webp', '.jpg', '.jpeg', '.svg', '.avif', '.gif']);

const MIN_DIM = 200;
const TINY_DIM = 96;
const DARK_LUMA_THRESHOLD = 35;
const LIGHT_LUMA_THRESHOLD = 220;
const EDGE_OPAQUE_RATIO = 0.6;
const EDGE_LIGHT_RATIO = 0.7;

function relLuma([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function inspectFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);
  const issues = [];
  const meta = {};

  if (!SUPPORTED.has(ext)) {
    return { fileName, skipped: 'unsupported-ext', issues, meta };
  }

  if (ext === '.svg') {
    const stat = statSync(filePath);
    meta.size = stat.size;
    if (stat.size < 200) issues.push({ kind: 'svg-tiny', detail: `${stat.size}B` });
    if (stat.size > 200_000) issues.push({ kind: 'svg-bloated', detail: `${(stat.size / 1024).toFixed(0)}KB` });
    return { fileName, ext, issues, meta };
  }

  let img;
  try {
    img = sharp(filePath);
  } catch (e) {
    issues.push({ kind: 'load-error', detail: e.message });
    return { fileName, ext, issues, meta };
  }

  let info;
  try {
    info = await img.metadata();
  } catch (e) {
    issues.push({ kind: 'metadata-error', detail: e.message });
    return { fileName, ext, issues, meta };
  }

  meta.width = info.width;
  meta.height = info.height;
  meta.format = info.format;
  meta.hasAlpha = info.hasAlpha;
  meta.size = statSync(filePath).size;

  if (!info.width || !info.height) {
    issues.push({ kind: 'invalid-dims' });
    return { fileName, ext, issues, meta };
  }

  if (info.width < TINY_DIM || info.height < TINY_DIM) {
    issues.push({ kind: 'tiny-dims', detail: `${info.width}x${info.height}` });
  } else if (info.width < MIN_DIM && info.height < MIN_DIM) {
    issues.push({ kind: 'small-dims', detail: `${info.width}x${info.height}` });
  }

  const aspect = info.width / info.height;
  if (aspect > 6 || aspect < 1 / 6) {
    issues.push({ kind: 'extreme-aspect', detail: aspect.toFixed(2) });
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    issues.push({ kind: 'jpeg-format', detail: 'JPEG cannot carry alpha — almost always wrong for logos' });
  }

  // Pull raw RGBA pixels for analysis. Resize to keep memory low; downscale preserves
  // averages well enough for these heuristics.
  const SAMPLE = 128;
  const { data, info: rawInfo } = await img
    .clone()
    .resize(SAMPLE, SAMPLE, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = rawInfo.channels;
  const w = rawInfo.width;
  const h = rawInfo.height;

  let totalLuma = 0;
  let opaqueCount = 0;
  let totalCount = 0;
  let lightOpaqueCount = 0;
  let darkOpaqueCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      totalCount++;
      if (a >= 200) {
        opaqueCount++;
        const luma = relLuma([r, g, b]);
        totalLuma += luma;
        if (luma > LIGHT_LUMA_THRESHOLD) lightOpaqueCount++;
        if (luma < DARK_LUMA_THRESHOLD) darkOpaqueCount++;
      }
    }
  }

  const opaqueRatio = opaqueCount / totalCount;
  const avgLuma = opaqueCount > 0 ? totalLuma / opaqueCount : 0;
  meta.opaqueRatio = +opaqueRatio.toFixed(3);
  meta.avgLuma = +avgLuma.toFixed(1);

  // Edge sampling — top/bottom rows + left/right columns
  let edgeTotal = 0;
  let edgeOpaque = 0;
  let edgeLight = 0;
  const sampleEdge = (y, x) => {
    const i = (y * w + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    edgeTotal++;
    if (a >= 200) {
      edgeOpaque++;
      const luma = relLuma([r, g, b]);
      if (luma > LIGHT_LUMA_THRESHOLD) edgeLight++;
    }
  };
  for (let x = 0; x < w; x++) {
    sampleEdge(0, x);
    sampleEdge(h - 1, x);
  }
  for (let y = 1; y < h - 1; y++) {
    sampleEdge(y, 0);
    sampleEdge(y, w - 1);
  }
  const edgeOpaqueRatio = edgeOpaque / edgeTotal;
  const edgeLightOfOpaque = edgeOpaque > 0 ? edgeLight / edgeOpaque : 0;
  meta.edgeOpaqueRatio = +edgeOpaqueRatio.toFixed(3);
  meta.edgeLightRatio = +edgeLightOfOpaque.toFixed(3);

  if (info.hasAlpha === false) {
    issues.push({ kind: 'no-alpha', detail: 'PNG/WEBP without alpha channel — bg won\'t be transparent' });
  }

  if (edgeOpaqueRatio > EDGE_OPAQUE_RATIO && edgeLightOfOpaque > EDGE_LIGHT_RATIO) {
    issues.push({
      kind: 'opaque-light-bg',
      detail: `edges ${(edgeOpaqueRatio * 100).toFixed(0)}% opaque, ${(edgeLightOfOpaque * 100).toFixed(0)}% light → renders as "white square"`,
    });
  }

  if (opaqueCount > 0 && avgLuma < DARK_LUMA_THRESHOLD) {
    issues.push({
      kind: 'logo-too-dark',
      detail: `avg luma ${avgLuma.toFixed(0)} → invisible on dark theme without invert`,
    });
  }

  // Mid-luma logos that are mostly grey are usually washed out
  if (opaqueCount > 0 && avgLuma > 120 && avgLuma < 170 && darkOpaqueCount < opaqueCount * 0.05 && lightOpaqueCount < opaqueCount * 0.05) {
    issues.push({
      kind: 'flat-grey',
      detail: `avg luma ${avgLuma.toFixed(0)}, no strong contrast → may look washed out`,
    });
  }

  // Suspiciously low file size for raster at the given dims = aggressive compression / artifacts
  const pixels = info.width * info.height;
  if (pixels > 0) {
    const bytesPerPixel = meta.size / pixels;
    meta.bytesPerPixel = +bytesPerPixel.toFixed(3);
    if ((ext === '.png' || ext === '.webp') && bytesPerPixel < 0.05 && pixels > 40_000) {
      issues.push({ kind: 'over-compressed', detail: `${bytesPerPixel.toFixed(2)} B/px` });
    }
  }

  return { fileName, ext, issues, meta };
}

async function main() {
  const files = readdirSync(LOGOS_DIR)
    .filter((f) => SUPPORTED.has(extname(f).toLowerCase()))
    .sort();

  const results = [];
  for (const f of files) {
    const r = await inspectFile(join(LOGOS_DIR, f));
    results.push(r);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const flagged = results.filter((r) => r.issues && r.issues.length > 0);
  const grouped = {};
  for (const r of flagged) {
    for (const issue of r.issues) {
      grouped[issue.kind] ??= [];
      grouped[issue.kind].push({ file: r.fileName, detail: issue.detail, meta: r.meta });
    }
  }

  console.log(`\n=== Logo audit — ${results.length} files inspected, ${flagged.length} with issues ===\n`);
  const order = [
    'opaque-light-bg',
    'logo-too-dark',
    'jpeg-format',
    'no-alpha',
    'tiny-dims',
    'small-dims',
    'extreme-aspect',
    'over-compressed',
    'flat-grey',
    'svg-tiny',
    'svg-bloated',
    'load-error',
    'metadata-error',
    'invalid-dims',
  ];
  for (const kind of order) {
    const entries = grouped[kind];
    if (!entries || entries.length === 0) continue;
    console.log(`-- ${kind} (${entries.length}) --`);
    for (const e of entries) {
      const m = e.meta || {};
      const dims = m.width ? ` ${m.width}x${m.height}` : '';
      console.log(`  ${e.file}${dims}  →  ${e.detail || ''}`);
    }
    console.log('');
  }

  // Any unknown kinds?
  const seen = new Set(order);
  for (const k of Object.keys(grouped)) {
    if (seen.has(k)) continue;
    console.log(`-- ${k} (${grouped[k].length}) --`);
    for (const e of grouped[k]) {
      console.log(`  ${e.file}  →  ${e.detail || ''}`);
    }
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
