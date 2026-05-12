// Hero image alignment: flip horizontally + optional downscale to balance
// auto/moto subjects on the homepage.
//
// Reads ChatGPT-rendered PNGs from $HERO_SOURCE_DIR (one folder, four files),
// writes the processed variants into public/images/hero-{auto,moto}-{light,dark}-vN.png.
//
// USAGE:
//   1. Place all 4 source PNGs in one folder.
//   2. Rename them so the script can find them (see pairs[] below) or update
//      the filenames in pairs[] to match what your renderer produced.
//   3. Run:
//        HERO_SOURCE_DIR=/path/to/folder node scripts/align-hero-images.mjs
//      (PowerShell:  $env:HERO_SOURCE_DIR='C:\path\to\folder'; node scripts/align-hero-images.mjs)
//
// HISTORY:
//   Source directions vary by ChatGPT batch — verify by eye each time:
//     auto: source faces RIGHT → flop=true → faces LEFT  on homepage
//     moto: source faces LEFT  → flop=true → faces RIGHT on homepage
//   Some batches render moto LARGER than auto. Use `scale` (e.g. 0.87) to shrink.

import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import process from "node:process";
import url from "node:url";

const SRC = process.env.HERO_SOURCE_DIR;
if (!SRC) {
  console.error(
    "ERROR: HERO_SOURCE_DIR env var not set.\n" +
      "Set it to the folder containing your 4 source PNGs, e.g.:\n" +
      "  HERO_SOURCE_DIR=/path/to/folder node scripts/align-hero-images.mjs\n" +
      "  PowerShell:  $env:HERO_SOURCE_DIR='C:\\path\\to\\folder'; node scripts/align-hero-images.mjs\n"
  );
  process.exit(1);
}

const OUT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "public",
  "images"
);

// Per-image: [outName, sourceFile, flop, scale]
// Bump the -vN suffix when you change source files so the browser/SW pulls
// fresh URLs (Next.js Image optimiser keys on the URL).
const pairs = [
  ["hero-auto-light-v9.png", "auto-light.png", true, 1.0],
  ["hero-moto-light-v9.png", "moto-light.png", true, 1.0],
  ["hero-auto-dark-v9.png", "auto-dark.png", true, 1.0],
  ["hero-moto-dark-v9.png", "moto-dark.png", true, 0.87],
];

// Set to true to also vertically align subject centroids; false preserves
// the original framing. User explicitly requested preserved proportions, so
// we leave alignment OFF.
const ENABLE_VERTICAL_ALIGN = false;

async function flippedRawRGBA(srcPath, flop, scale = 1) {
  // 1. Read source, optionally flop horizontally.
  let base = sharp(srcPath);
  if (flop) base = base.flop();
  const origMeta = await base.metadata();
  const origW = origMeta.width;
  const origH = origMeta.height;

  if (scale === 1) {
    const raw = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { meta: origMeta, raw };
  }

  // 2. Downscale the (already-flipped) image to scale*W x scale*H.
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const scaledBuf = await base.resize(newW, newH, { fit: "fill" }).png().toBuffer();

  // 3. Sample background colour from the original (top-left corner of the
  //    UN-scaled image) so the padded area matches.
  const sampleBuf = await sharp(srcPath)
    .flop()
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const bg = sampleBlock(sampleBuf.data, sampleBuf.info.width, 4, 4);

  // 4. Composite the scaled image onto a full-size canvas of the bg colour.
  //    Centre horizontally; pin vertically so the subject's GROUND LINE stays
  //    near the bottom of the canvas (the reflection floor sits at the bottom
  //    of the source). We push the scaled image to the bottom so the bike's
  //    wheels line up with where the floor used to be.
  const left = Math.floor((origW - newW) / 2);
  const top = origH - newH; // bottom-aligned

  const canvas = await sharp({
    create: {
      width: origW,
      height: origH,
      channels: 4,
      background: { r: Math.round(bg[0]), g: Math.round(bg[1]), b: Math.round(bg[2]), alpha: 1 },
    },
  })
    .composite([{ input: scaledBuf, left, top }])
    .png()
    .toBuffer();

  const composed = sharp(canvas);
  const meta = await composed.metadata();
  const raw = await composed.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { meta, raw };
}

// Sample a small block at (x, y) corner, return avg [r,g,b]
function sampleBlock(data, width, x0, y0, size = 12) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const idx = (y * width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

function colourDist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Find the subject's CENTROID (centre of mass in Y), weighted by how strongly
// each pixel deviates from background. This is robust against reflections and
// horizon lines because reflections contribute much less mass than the actual
// solid subject body.
//
// We also compute subjectTop / subjectBottom by row-density thresholding for
// reporting purposes.
function detectSubjectCentroid({ data, info }) {
  const { width, height, channels } = info;
  const bgTL = sampleBlock(data, width, 4, 4);
  const bgTR = sampleBlock(data, width, width - 16, 4);

  // For dark images we need a much higher threshold so the diffuse vignette /
  // grain doesn't get counted as subject. For light images bg is mostly flat
  // so a lower threshold works.
  const bgAvg = (bgTL[0] + bgTL[1] + bgTL[2]) / 3;
  const isLight = bgAvg > 128;
  const threshold = isLight ? 40 : 65;

  let massSum = 0;
  let weightedY = 0;
  // Per-row mass for top/bottom percentile detection.
  const rowMass = new Float64Array(height);

  for (let y = 0; y < height; y++) {
    let rm = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const px = [data[i], data[i + 1], data[i + 2]];
      const d = Math.min(colourDist(px, bgTL), colourDist(px, bgTR));
      if (d > threshold) {
        // Mass = (d - threshold), so faint reflections weigh much less than
        // solid body pixels. Cap at 200 to avoid extreme highlights skewing.
        rm += Math.min(d - threshold, 200);
      }
    }
    rowMass[y] = rm;
    massSum += rm;
    weightedY += y * rm;
  }

  const centroidY = massSum > 0 ? weightedY / massSum : height / 2;

  // Find top/bottom at 2% and 98% of cumulative mass for reporting / sanity.
  let cum = 0;
  let subjectTop = 0,
    subjectBottom = height - 1;
  const lowThresh = massSum * 0.02;
  const highThresh = massSum * 0.98;
  for (let y = 0; y < height; y++) {
    cum += rowMass[y];
    if (subjectTop === 0 && cum >= lowThresh) subjectTop = y;
    if (cum >= highThresh) {
      subjectBottom = y;
      break;
    }
  }

  return { width, height, centroidY, subjectTop, subjectBottom, bgTL, bgTR, massSum };
}

async function buildFlipped(srcFile, flop, scale) {
  const srcPath = path.join(SRC, srcFile);
  const { meta, raw } = await flippedRawRGBA(srcPath, flop, scale);
  return { srcPath, meta, raw };
}

// Translate an image vertically by `dy` pixels (positive = move subject DOWN),
// preserving canvas size. Fills exposed area with the corner-bg colour so
// reflections / floor blend in.
async function translateY(rawBuf, info, dy, bgColour) {
  const { width, height, channels } = info;
  if (dy === 0) {
    return sharp(rawBuf, { raw: { width, height, channels } }).png({ compressionLevel: 9 });
  }

  // Compose: blank canvas with bg colour, then composite raw image at offset.
  const bgImage = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: Math.round(bgColour[0]),
        g: Math.round(bgColour[1]),
        b: Math.round(bgColour[2]),
        alpha: 1,
      },
    },
  })
    .png()
    .toBuffer();

  // Convert raw to png buffer for composite
  const fgPng = await sharp(rawBuf, { raw: { width, height, channels } }).png().toBuffer();

  // dy > 0 means we want to shift the image DOWNWARD: composite at top=dy.
  // If dy < 0 we crop a slice from the top of fg and composite at top=0.
  if (dy > 0) {
    return sharp(bgImage)
      .composite([{ input: fgPng, top: dy, left: 0 }])
      .png({ compressionLevel: 9 });
  } else {
    // dy < 0: crop |dy| rows off the top of fg, then place at top=0
    const cropped = await sharp(fgPng)
      .extract({ left: 0, top: -dy, width, height: height + dy })
      .toBuffer();
    return sharp(bgImage)
      .composite([{ input: cropped, top: 0, left: 0 }])
      .png({ compressionLevel: 9 });
  }
}

(async () => {
  const flipped = {};
  for (const [outName, srcFile, flop, scale] of pairs) {
    flipped[outName] = await buildFlipped(srcFile, flop, scale);
    const tag = `${flop ? "Flipped" : "Kept   "}${scale !== 1 ? ` scale=${scale}` : ""}`;
    console.log(
      `${tag}: ${srcFile} (${flipped[outName].meta.width}x${flipped[outName].meta.height}) → ${outName}`
    );
  }

  // Compute vertical shifts (or 0 if alignment is disabled).
  const finalShifts = {};
  for (const [outName] of pairs) finalShifts[outName] = 0;

  if (ENABLE_VERTICAL_ALIGN) {
    const baselines = {};
    for (const [outName] of pairs) {
      const { raw } = flipped[outName];
      const det = detectSubjectCentroid(raw);
      baselines[outName] = det;
      console.log(
        `${outName}: centroidY=${det.centroidY.toFixed(1)}, top=${det.subjectTop}, bottom=${det.subjectBottom}, mass=${det.massSum.toExponential(2)}`
      );
    }
    const themes = ["light", "dark"];
    const outNames = pairs.map(([n]) => n);
    for (const theme of themes) {
      const autoKey = outNames.find((n) => n.includes(`auto-${theme}`));
      const motoKey = outNames.find((n) => n.includes(`moto-${theme}`));
      if (!autoKey || !motoKey) continue;
      const autoC = baselines[autoKey].centroidY;
      const motoC = baselines[motoKey].centroidY;
      const target = (autoC + motoC) / 2;
      finalShifts[autoKey] = Math.round(target - autoC);
      finalShifts[motoKey] = Math.round(target - motoC);
      console.log(
        `Theme ${theme}: target centroidY=${target.toFixed(1)}, shift auto=${finalShifts[autoKey]}, shift moto=${finalShifts[motoKey]}`
      );
    }
  } else {
    console.log("Vertical alignment DISABLED — preserving original source framing.");
  }

  await fs.mkdir(OUT, { recursive: true });
  for (const [outName] of pairs) {
    const { raw } = flipped[outName];
    const dy = finalShifts[outName] || 0;
    // bg colour only needed when we have to fill exposed canvas after shifting.
    const bg = dy !== 0 ? sampleBlock(raw.data, raw.info.width, 4, 4) : [255, 255, 255];
    const pipeline = await translateY(raw.data, raw.info, dy, bg);
    const outPath = path.join(OUT, outName);
    await pipeline.toFile(outPath);
    console.log(`Wrote ${outPath} (shift dy=${dy})`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
