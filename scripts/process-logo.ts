import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type Mode = 'brighten' | 'invert' | 'white';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function normalizeLogoRelPath(p: string): string {
  // Accept: "dinan.avif" or "logos/dinan.avif" or "/logos/dinan.avif"
  let v = p.trim();
  v = v.replace(/^\/+/, '');
  if (v.startsWith('public/')) v = v.slice('public/'.length);
  if (v.startsWith('logos/')) v = v.slice('logos/'.length);
  return v;
}

async function main() {
  const inPath = getArg('--in');
  const out = getArg('--out');
  const mode = (getArg('--mode') as Mode | undefined) ?? 'brighten';
  const deleteOld = hasFlag('--delete-old');

  if (!inPath || !out) {
    console.error('Usage: npx tsx scripts/process-logo.ts --in <path> --out <filename> [--mode brighten|invert|white] [--delete-old]');
    console.error('Example: npx tsx scripts/process-logo.ts --in D:/dinan.avif --out dinan.avif --mode brighten --delete-old');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const logosDir = path.join(repoRoot, 'public', 'logos');
  const outFileName = normalizeLogoRelPath(out);
  const outAbs = path.join(logosDir, outFileName);

  await fs.mkdir(path.dirname(outAbs), { recursive: true });

  const input = sharp(inPath, { failOn: 'none' });
  const meta = await input.metadata();

  let pipeline = input;

  // Normalize to something web-friendly; keep alpha.
  pipeline = pipeline.ensureAlpha();

  if (mode === 'invert') {
    pipeline = pipeline.negate({ alpha: false });
  } else if (mode === 'brighten') {
    // Gentle brighten; tries to preserve colors.
    pipeline = pipeline.modulate({ brightness: 1.35, saturation: 1.05 });
    pipeline = pipeline.gamma(1.1);
  } else if (mode === 'white') {
    // Turn all non-transparent pixels into white, keep original alpha.
    // This is the most reliable for dark backgrounds.
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;

    // Extract alpha channel
    const alpha = Buffer.alloc(info.width * info.height);
    for (let i = 0, p = 0; i < data.length; i += channels, p++) {
      alpha[p] = data[i + 3];
    }

    const whiteRgb = Buffer.alloc(info.width * info.height * 3, 255);
    pipeline = sharp(whiteRgb, { raw: { width: info.width, height: info.height, channels: 3 } })
      .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } });
  }

  // Decide output format from extension.
  const ext = path.extname(outFileName).toLowerCase();

  if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: 92 });
  } else if (ext === '.avif') {
    pipeline = pipeline.avif({ quality: 60 });
  } else if (ext === '.jpg' || ext === '.jpeg') {
    // JPG drops alpha, so flatten on transparent → black is bad; flatten on black-ish.
    pipeline = pipeline.flatten({ background: { r: 0, g: 0, b: 0 } }).jpeg({ quality: 92 });
  } else {
    // Default to png if unknown
    const fallback = outAbs.replace(ext, '.png');
    console.warn(`Unknown extension "${ext}", writing PNG instead: ${path.basename(fallback)}`);
    await pipeline.png({ compressionLevel: 9 }).toFile(fallback);
    return;
  }

  if (deleteOld) {
    // Delete other variants of the same base name (dinan.png/svg/webp/...)
    const base = outFileName.replace(/\.[^.]+$/, '');
    const entries = await fs.readdir(logosDir);
    await Promise.all(
      entries
        .filter(name => name.toLowerCase().startsWith(base.toLowerCase() + '.'))
        .filter(name => name !== path.basename(outAbs))
        .map(name => fs.rm(path.join(logosDir, name), { force: true }))
    );
  }

  await pipeline.toFile(outAbs);

  const stat = await fs.stat(outAbs);
  console.log('✅ Logo processed');
  console.log(`- Mode: ${mode}`);
  console.log(`- Output: ${outAbs}`);
  console.log(`- Size: ${stat.size} bytes`);
  if (meta.width && meta.height) {
    console.log(`- Input dims: ${meta.width}x${meta.height}`);
  }
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
