import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, "public", "forged", "designs");
const SIZE = 2048;
const MATERIALS = ["aluminium", "magnesium", "carbon"];

const DESIGN_NAMES = {
  "forged-spoke-pro": "Forged Spoke Pro",
  "forged-mesh-x": "Forged Mesh X",
  "forged-heritage-5": "Forged Heritage 5",
  "forged-splitline": "Forged Splitline",
  "forged-twin-spoke": "Forged Twin-Spoke",
};

function parseArgs(argv) {
  const pairs = {};
  for (const arg of argv) {
    const idx = arg.indexOf("=");
    if (idx === -1) continue;
    pairs[arg.slice(0, idx)] = arg.slice(idx + 1);
  }
  return pairs;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function removeGreenBackground(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const greenScore = g - Math.max(r, b);
    if (g > 135 && greenScore > 45) {
      const hard = g > 175 && greenScore > 80;
      data[i + 3] = hard ? 0 : Math.max(0, Math.min(255, (80 - greenScore) * 3));
      if (data[i + 3] < 10) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    } else if (greenScore > 12) {
      // Despill chroma reflections on shiny metal and antialiased tire edges.
      data[i + 1] = Math.max(r, b) + Math.round((g - Math.max(r, b)) * 0.22);
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

async function clipToWheelCircle(sourcePng) {
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

      const alpha = data[idx + 3];
      if (distance >= radius) {
        data[idx + 3] = 0;
      } else {
        const keep = (radius - distance) / feather;
        data[idx + 3] = Math.round(alpha * Math.max(0, Math.min(1, keep)));
      }
    }
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

function brandOverlaySvg(designName) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <pattern id="carbon" patternUnits="userSpaceOnUse" width="26" height="26" patternTransform="rotate(45)">
        <rect width="26" height="26" fill="#050607"/>
        <rect x="0" y="0" width="13" height="6" fill="#202428" opacity="0.85"/>
        <rect x="13" y="13" width="13" height="6" fill="#202428" opacity="0.75"/>
      </pattern>
      <path id="capText" d="M 938 1024 a 86 86 0 1 1 172 0 a 86 86 0 1 1 -172 0"/>
      <path id="flowPath" d="M 562 360 A 650 650 0 0 1 1486 360"/>
    </defs>
    <circle cx="1024" cy="1024" r="99" fill="#07090b" opacity="0.92"/>
    <circle cx="1024" cy="1024" r="94" fill="url(#carbon)" stroke="#dfe5e8" stroke-width="3" opacity="0.96"/>
    <circle cx="1024" cy="1024" r="67" fill="#050607" opacity="0.68"/>
    <text x="1024" y="1015" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#f7f9fa">ONE</text>
    <text x="1024" y="1052" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="#f7f9fa" letter-spacing="2.2">COMPANY</text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#f7f9fa" letter-spacing="0.9" opacity="0.74">
      <textPath href="#capText" startOffset="0%">ONE COMPANY · 6061-T6 FORGED PROGRAM · PRECISION TAILORED WHEELS · </textPath>
    </text>
    <text font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" fill="#f7f9fa" opacity="0.14" letter-spacing="3">
      <textPath href="#flowPath" startOffset="40%">FLOW FORGED</textPath>
    </text>
  </svg>`);
}

function carbonTextureSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <pattern id="weave" patternUnits="userSpaceOnUse" width="56" height="56" patternTransform="rotate(45)">
        <rect width="56" height="56" fill="transparent"/>
        <rect x="0" y="0" width="28" height="10" fill="#59616a" opacity="0.12"/>
        <rect x="28" y="28" width="28" height="10" fill="#59616a" opacity="0.10"/>
        <rect x="0" y="30" width="28" height="8" fill="#000" opacity="0.16"/>
        <rect x="28" y="2" width="28" height="8" fill="#000" opacity="0.14"/>
      </pattern>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#weave)" opacity="0.45"/>
  </svg>`);
}

async function applyBranding(basePng, designName) {
  return sharp(basePng)
    .composite([{ input: brandOverlaySvg(designName), blend: "over" }])
    .png()
    .toBuffer();
}

async function materialVariant(brandedPng, material) {
  if (material === "aluminium") return brandedPng;

  if (material === "magnesium") {
    return sharp(brandedPng)
      .modulate({ brightness: 0.78, saturation: 0.35 })
      .tint({ r: 170, g: 174, b: 171 })
      .png()
      .toBuffer();
  }

  return sharp(brandedPng)
    .modulate({ brightness: 0.56, saturation: 0.25 })
    .composite([{ input: carbonTextureSvg(), blend: "overlay" }])
    .png()
    .toBuffer();
}

function studioBackgroundSvg(material, designName) {
  const tone =
    material === "aluminium" ? "#b8c0c2" : material === "magnesium" ? "#555b5d" : "#1c2025";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#22262b"/>
        <stop offset="100%" stop-color="#050607"/>
      </radialGradient>
      <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="transparent"/>
        <stop offset="50%" stop-color="${tone}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="transparent"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <rect x="0" y="1470" width="${SIZE}" height="2" fill="url(#line)"/>
    <ellipse cx="1024" cy="1535" rx="650" ry="90" fill="#000" opacity="0.42"/>
    <text x="112" y="140" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#c48e4c" letter-spacing="8">ONE COMPANY FORGED</text>
    <text x="112" y="190" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#ffffff" opacity="0.78">${esc(designName)}</text>
  </svg>`);
}

async function writeVisualSet(slug, material, wheelPng) {
  const designName = DESIGN_NAMES[slug] ?? slug;
  const outDir = path.join(OUT_ROOT, slug, "materials", material);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "wheel.png"), wheelPng);

  const wheelLarge = await sharp(wheelPng).resize(1660, 1660, { fit: "contain" }).png().toBuffer();
  await sharp(studioBackgroundSvg(material, designName))
    .composite([{ input: wheelLarge, left: 194, top: 250 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(outDir, "hero.jpg"));

  await sharp({
    create: { width: 1600, height: 1200, channels: 4, background: "#07080a" },
  })
    .composite([
      {
        input: await sharp(studioBackgroundSvg(material, designName))
          .resize(1600, 1200, { fit: "cover" })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
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

async function copyAluminiumLegacy(slug) {
  const base = path.join(OUT_ROOT, slug);
  const aluminium = path.join(base, "materials", "aluminium");
  await fs.mkdir(base, { recursive: true });
  for (const name of ["hero.jpg", "wheel.png", "01.jpg", "02.jpg", "03.jpg"]) {
    await fs.copyFile(path.join(aluminium, name), path.join(base, name));
  }
}

async function processDesign(slug, sourcePath) {
  const source = path.resolve(sourcePath);
  const designName = DESIGN_NAMES[slug] ?? slug;
  const keyed = await removeGreenBackground(source);
  const clipped = await clipToWheelCircle(keyed);
  const branded = await applyBranding(clipped, designName);
  for (const material of MATERIALS) {
    const variant = await materialVariant(branded, material);
    await writeVisualSet(slug, material, variant);
  }
  await copyAluminiumLegacy(slug);
}

async function main() {
  const pairs = parseArgs(process.argv.slice(2));
  for (const [slug, sourcePath] of Object.entries(pairs)) {
    await processDesign(slug, sourcePath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
