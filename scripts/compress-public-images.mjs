#!/usr/bin/env node
/*
 * Compress oversized images in /public/images in-place using sharp.
 *
 * - PNG/JPG > 500KB are resized to max 1920px wide and re-encoded.
 * - PNG photos (large dimensions, no transparency hint) become JPG quality 82.
 * - PNG with transparency stay PNG but go through palette + zlib 9.
 * - JPG → quality 82, mozjpeg.
 * - WEBP > 500KB → quality 80.
 * - Idempotent: skips files where the new size would not be ≥ 15% smaller.
 *
 * Usage:
 *   node scripts/compress-public-images.mjs            (dry-run)
 *   node scripts/compress-public-images.mjs --commit   (write changes)
 *   node scripts/compress-public-images.mjs --commit --limit=5
 *   node scripts/compress-public-images.mjs --commit --pattern="hero-*"
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd(), 'public/images');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const PATTERN = (args.find(a => a.startsWith('--pattern=')) || '').split('=')[1];
const MIN_BYTES = 500 * 1024;
const MAX_WIDTH = 1920;
const MIN_SAVING = 0.15; // require ≥15% reduction to overwrite
const QUALITY_JPG = 82;
const QUALITY_WEBP = 80;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function compressOne(file) {
  const ext = path.extname(file).toLowerCase();
  const stat = await fs.stat(file);
  if (stat.size < MIN_BYTES) return { file, skip: 'small' };

  let pipeline = sharp(file, { failOn: 'error' }).rotate();
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let outBuf;
  let newExt = ext;
  if (ext === '.jpg' || ext === '.jpeg') {
    outBuf = await pipeline.jpeg({ quality: QUALITY_JPG, mozjpeg: true, progressive: true }).toBuffer();
  } else if (ext === '.webp') {
    outBuf = await pipeline.webp({ quality: QUALITY_WEBP, effort: 6 }).toBuffer();
  } else if (ext === '.png') {
    // Always keep PNG (no rename → no broken refs). Aggressive zlib + palette quantization.
    outBuf = await pipeline.png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 }).toBuffer();
  } else {
    return { file, skip: 'ext' };
  }

  const saving = 1 - outBuf.length / stat.size;
  if (saving < MIN_SAVING) return { file, skip: `only ${(saving * 100).toFixed(0)}% saving` };

  return {
    file,
    before: stat.size,
    after: outBuf.length,
    saving,
    newExt,
    buf: outBuf,
  };
}

async function main() {
  console.log(`mode: ${COMMIT ? 'COMMIT (will overwrite files)' : 'DRY-RUN'}`);
  console.log(`root: ${ROOT}`);
  if (PATTERN) console.log(`pattern: ${PATTERN}`);
  if (LIMIT !== Infinity) console.log(`limit: ${LIMIT}`);

  const candidates = [];
  for await (const file of walk(ROOT)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
    if (PATTERN && !path.basename(file).includes(PATTERN)) continue;
    const stat = await fs.stat(file);
    if (stat.size < MIN_BYTES) continue;
    candidates.push(file);
  }
  candidates.sort((a, b) => 0); // keep walk order

  let processed = 0, savedBytes = 0, totalBefore = 0, skipped = 0;
  const renames = [];
  for (const file of candidates) {
    if (processed >= LIMIT) break;
    try {
      const r = await compressOne(file);
      if (r.skip) { skipped++; continue; }
      processed++;
      totalBefore += r.before;
      savedBytes += r.before - r.after;
      const rel = path.relative(process.cwd(), r.file).replace(/\\/g, '/');
      console.log(`  ${fmt(r.before).padStart(8)} -> ${fmt(r.after).padStart(8)}  (-${(r.saving * 100).toFixed(0)}%)  ${rel}${r.newExt !== path.extname(r.file).toLowerCase() ? ` [→ ${r.newExt}]` : ''}`);
      if (COMMIT) {
        const target = r.newExt !== path.extname(r.file).toLowerCase()
          ? r.file.replace(/\.png$/i, r.newExt)
          : r.file;
        await fs.writeFile(target, r.buf);
        if (target !== r.file) {
          await fs.unlink(r.file);
          renames.push({ from: r.file, to: target });
        }
      }
    } catch (err) {
      console.warn(`  ! ${file}: ${err.message}`);
      skipped++;
    }
  }

  console.log('');
  console.log(`processed:   ${processed}`);
  console.log(`skipped:     ${skipped}`);
  console.log(`before:      ${fmt(totalBefore)}`);
  console.log(`after:       ${fmt(totalBefore - savedBytes)}`);
  console.log(`saved:       ${fmt(savedBytes)}  (${totalBefore ? ((savedBytes / totalBefore) * 100).toFixed(1) : 0}%)`);
  if (renames.length) {
    console.log('');
    console.log('renames (PNG → JPG): you must update any code that references the old extension:');
    for (const r of renames) {
      console.log(`  ${path.relative(process.cwd(), r.from).replace(/\\/g, '/')} -> ${path.relative(process.cwd(), r.to).replace(/\\/g, '/')}`);
    }
  }
  if (!COMMIT) console.log('\n(dry-run: pass --commit to write changes)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
