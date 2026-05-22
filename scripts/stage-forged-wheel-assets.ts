import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { FORGED_DESIGNS } from "@/data/forgedDesigns";
import { FORGED_CENTER_CAP_ASSET, getForgedStagingRoot } from "@/lib/forged/generationQueue";
import type { Material } from "@/lib/forged/configSchema";

const SIZE = 2048;
const MATERIALS: Material[] = ["aluminium", "magnesium", "carbon"];

function parsePairs(argv: string[]) {
  const pairs = new Map<string, string>();
  for (const arg of argv) {
    const idx = arg.indexOf("=");
    if (idx === -1) continue;
    pairs.set(arg.slice(0, idx), arg.slice(idx + 1));
  }
  return pairs;
}

async function removeGreenBackground(sourcePath: string) {
  const { data, info } = await sharp(sourcePath)
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 255, b: 0, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenScore = g - Math.max(r, b);
    if (g > 135 && greenScore > 45) {
      data[i + 3] =
        g > 175 && greenScore > 80 ? 0 : Math.max(0, Math.min(255, (80 - greenScore) * 3));
    } else if (greenScore > 12) {
      data[i + 1] = Math.max(r, b) + Math.round((g - Math.max(r, b)) * 0.22);
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function clipToWheelCircle(sourcePng: Buffer) {
  const { data, info } = await sharp(sourcePng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  const radius = SIZE * 0.463;
  const feather = SIZE * 0.018;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const idx = (y * info.width + x) * 4;
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius - feather) continue;
      if (distance >= radius) data[idx + 3] = 0;
      else data[idx + 3] = Math.round(data[idx + 3] * ((radius - distance) / feather));
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function oneCompanyCapOverlay() {
  const capPath = path.join(process.cwd(), "public", FORGED_CENTER_CAP_ASSET.replace(/^\/+/, ""));
  return sharp(capPath).resize(270, 270).png().toBuffer();
}

async function applyCenterCap(wheelPng: Buffer) {
  const cap = await oneCompanyCapOverlay();
  return sharp(wheelPng)
    .composite([{ input: cap, left: Math.round(SIZE / 2 - 135), top: Math.round(SIZE / 2 - 135) }])
    .png()
    .toBuffer();
}

async function materialVariant(brandedPng: Buffer, material: Material) {
  if (material === "aluminium") return brandedPng;
  if (material === "magnesium") {
    return sharp(brandedPng)
      .modulate({ brightness: 0.78, saturation: 0.35 })
      .tint({ r: 170, g: 174, b: 171 })
      .png()
      .toBuffer();
  }
  return sharp(brandedPng).modulate({ brightness: 0.56, saturation: 0.24 }).png().toBuffer();
}

function studioBackgroundSvg(designName: string, material: Material) {
  const tone =
    material === "aluminium" ? "#c5cbd0" : material === "magnesium" ? "#747a7d" : "#1f252b";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#242930"/>
        <stop offset="100%" stop-color="#050607"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <rect x="0" y="1470" width="${SIZE}" height="2" fill="${tone}" opacity="0.28"/>
    <ellipse cx="1024" cy="1535" rx="650" ry="90" fill="#000" opacity="0.42"/>
    <text x="112" y="140" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#c48e4c" letter-spacing="8">ONE COMPANY FORGED</text>
    <text x="112" y="190" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#ffffff" opacity="0.78">${designName}</text>
  </svg>`);
}

async function writeVisualSet(slug: string, material: Material, wheelPng: Buffer) {
  const design = FORGED_DESIGNS.find((item) => item.slug === slug);
  const designName = design?.nameEn ?? slug;
  const publicRoot = getForgedStagingRoot(slug).replace(/^\/+/, "");
  const outDir = path.join(process.cwd(), "public", publicRoot, "materials", material);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "wheel.png"), wheelPng);

  const wheelLarge = await sharp(wheelPng).resize(1660, 1660, { fit: "contain" }).png().toBuffer();
  await sharp(studioBackgroundSvg(designName, material))
    .composite([{ input: wheelLarge, left: 194, top: 250 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(outDir, "hero.jpg"));

  await sharp(studioBackgroundSvg(designName, material))
    .resize(1600, 1200, { fit: "cover" })
    .composite([
      { input: await sharp(wheelPng).resize(1180, 1180).png().toBuffer(), left: 210, top: 5 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(outDir, "01.jpg"));

  await sharp(wheelPng)
    .extract({ left: 704, top: 704, width: 640, height: 640 })
    .resize(1600, 1200, { fit: "cover" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(outDir, "02.jpg"));
  await sharp(wheelPng)
    .extract({ left: 1088, top: 1400, width: 720, height: 520 })
    .resize(1600, 1200, { fit: "cover" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(outDir, "03.jpg"));
}

async function copyAluminiumLegacy(slug: string) {
  const publicRoot = getForgedStagingRoot(slug).replace(/^\/+/, "");
  const base = path.join(process.cwd(), "public", publicRoot);
  const aluminium = path.join(base, "materials", "aluminium");
  await mkdir(base, { recursive: true });
  for (const name of ["hero.jpg", "wheel.png", "01.jpg", "02.jpg", "03.jpg"]) {
    await copyFile(path.join(aluminium, name), path.join(base, name));
  }
}

async function processDesign(slug: string, sourcePath: string) {
  if (!FORGED_DESIGNS.some((item) => item.slug === slug)) {
    throw new Error(`Unknown forged design slug: ${slug}`);
  }
  const keyed = await removeGreenBackground(path.resolve(sourcePath));
  const clipped = await clipToWheelCircle(keyed);
  const branded = await applyCenterCap(clipped);
  for (const material of MATERIALS) {
    await writeVisualSet(slug, material, await materialVariant(branded, material));
  }
  await copyAluminiumLegacy(slug);
}

async function main() {
  const pairs = parsePairs(process.argv.slice(2));
  if (!pairs.size) {
    throw new Error("Usage: tsx scripts/stage-forged-wheel-assets.ts oc-p101sc=C:/path/source.png");
  }
  for (const [slug, sourcePath] of pairs) {
    await processDesign(slug, sourcePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
