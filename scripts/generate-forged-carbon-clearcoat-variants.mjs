import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const RENDER_ROOT = path.join(ROOT, "public", "forged", "renders");
const DESIGNS = [
  "forged-spoke-pro",
  "forged-mesh-x",
  "forged-heritage-5",
  "forged-splitline",
  "forged-twin-spoke",
];
const PRESET_COLORS = [
  "#0a0a0a",
  "#1c1c1c",
  "#2d2d2d",
  "#5a5a5a",
  "#bababa",
  "#dedede",
  "#c48e4c",
  "#7a4a1a",
  "#7a1f1f",
  "#1c3a5a",
  "#0d3a2a",
  "#3a3a8a",
];

const WHEEL_MASKS = {
  "mercedes-g63-w465": [
    { x: 0.225, y: 0.64, r: 0.105 },
    { x: 0.775, y: 0.64, r: 0.105 },
  ],
};

function hexToRgb(hex) {
  const value = hex.replace(/^#/, "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function colorToken(hex) {
  return hex.replace(/^#/, "").toLowerCase();
}

function inWheelFace(x, y, width, height, masks) {
  return masks.some((mask) => {
    const cx = mask.x * width;
    const cy = mask.y * height;
    const radius = mask.r * width;
    return Math.hypot(x - cx, y - cy) <= radius;
  });
}

async function tintCarbonClearcoat(source, targetHex, masks) {
  const target = hexToRgb(targetHex);
  const { data, info } = await sharp(source)
    .resize(1600, 1000, { fit: "cover", position: "center" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!inWheelFace(x, y, info.width, info.height, masks)) continue;

      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 2;
      if (lightness < 16) continue;

      const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      const highlight = Math.min(1, Math.max(0, (lightness - 22) / 118));
      const strength = 0.18 + highlight * 0.24;
      const shade = 0.5 + luminance * 0.75;

      data[idx] = Math.round(r * (1 - strength) + Math.min(255, target.r * shade) * strength);
      data[idx + 1] = Math.round(g * (1 - strength) + Math.min(255, target.g * shade) * strength);
      data[idx + 2] = Math.round(b * (1 - strength) + Math.min(255, target.b * shade) * strength);
    }
  }

  return sharp(data, { raw: info }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

async function writeCarbonColors(carSlug, designSlug) {
  const masks = WHEEL_MASKS[carSlug];
  if (!masks) throw new Error(`No wheel masks configured for ${carSlug}`);

  const base = path.join(RENDER_ROOT, carSlug, designSlug, "carbon.jpg");
  await fs.access(base);

  const colorDir = path.join(RENDER_ROOT, carSlug, designSlug, "carbon");
  await fs.mkdir(colorDir, { recursive: true });

  for (const color of PRESET_COLORS) {
    const target = path.join(colorDir, `${colorToken(color)}.jpg`);
    if (color.toLowerCase() === "#1c1c1c") {
      await sharp(base)
        .resize(1600, 1000, { fit: "cover", position: "center" })
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(target);
      continue;
    }

    const buffer = await tintCarbonClearcoat(base, color, masks);
    await fs.writeFile(target, buffer);
  }
}

async function main() {
  const carSlug = process.argv[2] ?? "mercedes-g63-w465";
  const designs = process.argv.slice(3);
  const targetDesigns = designs.length ? designs : DESIGNS;
  for (const designSlug of targetDesigns) {
    await writeCarbonColors(carSlug, designSlug);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
