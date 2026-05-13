// One-off helper: take the existing public/images/hero-moto-{light,dark}-v9.png
// and shrink the bike to SCALE of canvas size.
//
// Backdrop construction: we cannot just use a flat corner colour (vignette
// makes it darker than the centre) nor a blurred copy of the original (the
// bike silhouette bleeds through as a "ghost bike"). Instead we build a clean
// vertical gradient by sampling, for each row Y, only the LEFT-EDGE and
// RIGHT-EDGE strips of that row in the source — those strips contain only
// studio backdrop, no bike. Averaging gives one bg colour per Y. The
// resulting 1×H column is then stretched to W×H, giving a smooth vertical
// gradient that matches the source vignette exactly without any bike traces.
//
// Usage:
//   node scripts/shrink-moto-hero.mjs
//
// Tunables:
//   SCALE      — fraction of canvas the bike occupies (1.0 = no change)
//   EDGE_PX    — width of left/right strips sampled per row (must be inside
//                the bike-free zone — bike spans roughly X=80..760 of 941)

import sharp from "sharp";
import path from "node:path";
import url from "node:url";

const SCALE = 0.92;
const EDGE_PX = 40;

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const PUBLIC_IMAGES = path.resolve(HERE, "..", "public", "images");

const targets = [
  { in: "hero-moto-light-v9.png", out: "hero-moto-light-v10.png" },
  { in: "hero-moto-dark-v9.png", out: "hero-moto-dark-v10.png" },
];

for (const t of targets) {
  const inPath = path.join(PUBLIC_IMAGES, t.in);
  const outPath = path.join(PUBLIC_IMAGES, t.out);

  // 1. Read source as raw RGBA.
  const { data, info } = await sharp(inPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const channels = info.channels; // 4

  // 2. Build a 1×H bg column by averaging left+right edge strips per row.
  const colBuf = Buffer.alloc(H * channels);
  for (let y = 0; y < H; y++) {
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    // Left strip
    for (let x = 0; x < EDGE_PX; x++) {
      const i = (y * W + x) * channels;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    // Right strip
    for (let x = W - EDGE_PX; x < W; x++) {
      const i = (y * W + x) * channels;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    colBuf[y * channels] = Math.round(r / n);
    colBuf[y * channels + 1] = Math.round(g / n);
    colBuf[y * channels + 2] = Math.round(b / n);
    colBuf[y * channels + 3] = 255;
  }

  // 3. Convert 1×H column to W×H bg via horizontal stretch.
  const bgPng = await sharp(colBuf, { raw: { width: 1, height: H, channels } })
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  // 4. Downscale the original for the sharp subject layer.
  const newW = Math.round(W * SCALE);
  const newH = Math.round(H * SCALE);
  const shrunkSubject = await sharp(inPath).resize(newW, newH, { fit: "fill" }).png().toBuffer();

  // 5. Composite shrunk subject onto gradient bg. Centre horizontally,
  //    bottom-align vertically so the wheels sit on the floor reflection.
  const left = Math.floor((W - newW) / 2);
  const top = H - newH;

  await sharp(bgPng)
    .composite([{ input: shrunkSubject, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`Wrote ${outPath}  (${W}x${H}, scale=${SCALE}, edge strip ${EDGE_PX}px)`);
}
