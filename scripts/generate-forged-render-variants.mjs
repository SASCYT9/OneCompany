import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const RENDER_ROOT = path.join(ROOT, "public", "forged", "renders");
const DESIGNS = ["oc-p101sc", "oc-p104sc", "oc-fd15", "oc-pf13-rs", "oc-mv-cr05"];
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
  "bmw-m3-g80": [
    { x: 0.235, y: 0.66, r: 0.085 },
    { x: 0.795, y: 0.66, r: 0.085 },
  ],
  "bmw-m2-g87": [
    { x: 0.24, y: 0.66, r: 0.082 },
    { x: 0.78, y: 0.66, r: 0.082 },
  ],
  "bmw-m5-g90": [
    { x: 0.225, y: 0.665, r: 0.082 },
    { x: 0.8, y: 0.665, r: 0.082 },
  ],
  "porsche-cayenne-turbo": [
    { x: 0.24, y: 0.62, r: 0.105 },
    { x: 0.79, y: 0.62, r: 0.105 },
  ],
  "honda-civic-type-r-fl5": [
    { x: 0.235, y: 0.66, r: 0.082 },
    { x: 0.79, y: 0.66, r: 0.082 },
  ],
  "tesla-model-y": [
    { x: 0.235, y: 0.65, r: 0.092 },
    { x: 0.79, y: 0.65, r: 0.092 },
  ],
  "tesla-model-s-plaid": [
    { x: 0.215, y: 0.665, r: 0.084 },
    { x: 0.8, y: 0.665, r: 0.084 },
  ],
  "mercedes-g63-w465": [
    { x: 0.225, y: 0.66, r: 0.142 },
    { x: 0.78, y: 0.66, r: 0.142 },
  ],
  "mercedes-gt63-w296": [
    { x: 0.21, y: 0.66, r: 0.088 },
    { x: 0.81, y: 0.66, r: 0.088 },
  ],
  "porsche-992-gt3": [
    { x: 0.21, y: 0.66, r: 0.092 },
    { x: 0.81, y: 0.66, r: 0.092 },
  ],
  "porsche-992-turbo": [
    { x: 0.215, y: 0.66, r: 0.09 },
    { x: 0.81, y: 0.66, r: 0.09 },
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

function pixelMaskAlpha(r, g, b, x, y, width, height, masks) {
  const inWheel = masks.some((mask) => {
    const cx = mask.x * width;
    const cy = mask.y * height;
    const radius = mask.r * width;
    const feather = width * 0.018;
    const distance = Math.hypot(x - cx, y - cy);
    if (distance > radius) return false;
    if (distance < radius - feather) return true;
    return (radius - distance) / feather > 0.15;
  });
  if (!inWheel) return 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const lightness = (max + min) / 2;
  if (lightness < 42) return 0;
  if (saturation > 0.38 && lightness < 165) return 0;
  return Math.max(0, Math.min(255, Math.round((lightness - 42) * 1.45)));
}

async function recolorWheels(source, targetHex, options = {}) {
  const target = hexToRgb(targetHex);
  const masks = options.masks;
  const { data, info } = await sharp(source)
    .resize(1600, 1000, { fit: "cover", position: "center" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = pixelMaskAlpha(r, g, b, x, y, info.width, info.height, masks) / 255;
      if (alpha <= 0) continue;

      const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      const shade = 0.42 + luminance * 0.78;
      const mix = options.strength ?? 0.72;
      const nr = Math.min(255, target.r * shade);
      const ng = Math.min(255, target.g * shade);
      const nb = Math.min(255, target.b * shade);

      data[idx] = Math.round(r * (1 - alpha * mix) + nr * alpha * mix);
      data[idx + 1] = Math.round(g * (1 - alpha * mix) + ng * alpha * mix);
      data[idx + 2] = Math.round(b * (1 - alpha * mix) + nb * alpha * mix);
    }
  }

  return sharp(data, { raw: info }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

async function materialVariant(source, material, masks) {
  if (material === "magnesium") {
    const recolored = await recolorWheels(source, "#a9ada8", { masks, strength: 0.52 });
    return sharp(recolored)
      .modulate({ saturation: 0.86, brightness: 0.96 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  if (material === "carbon") {
    const dark = await recolorWheels(source, "#1b1f22", { masks, strength: 0.78 });
    return sharp(dark)
      .modulate({ saturation: 0.76, brightness: 0.88 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  return sharp(source)
    .resize(1600, 1000, { fit: "cover", position: "center" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function writeIfSourceExists(carSlug, designSlug) {
  const masks = WHEEL_MASKS[carSlug];
  if (!masks) throw new Error(`No wheel masks configured for ${carSlug}`);

  const base = path.join(RENDER_ROOT, carSlug, designSlug, "aluminium.jpg");
  try {
    await fs.access(base);
  } catch {
    console.warn(`skip missing ${base}`);
    return;
  }

  // Carbon is not a color/material transform. It needs a dedicated AI render
  // with real weave, clearcoat depth, and different highlight behavior.
  for (const material of ["aluminium", "magnesium"]) {
    const materialPath = path.join(RENDER_ROOT, carSlug, designSlug, `${material}.jpg`);
    const materialBuffer = await materialVariant(base, material, masks);
    if (material !== "aluminium") {
      await fs.writeFile(materialPath, materialBuffer);
    }

    if (process.env.GENERATE_COLOR_VARIANTS === "1") {
      const colorDir = path.join(RENDER_ROOT, carSlug, designSlug, material);
      await fs.mkdir(colorDir, { recursive: true });
      for (const color of PRESET_COLORS) {
        const colorPath = path.join(colorDir, `${colorToken(color)}.jpg`);
        const buffer =
          color.toLowerCase() === "#1c1c1c"
            ? materialBuffer
            : await recolorWheels(materialBuffer, color, { masks, strength: 0.66 });
        await fs.writeFile(colorPath, buffer);
      }
    }
  }
}

async function main() {
  const carSlug = process.argv[2] ?? "mercedes-g63-w465";
  const designs = process.argv.slice(3);
  const targetDesigns = designs.length ? designs : DESIGNS;
  for (const designSlug of targetDesigns) {
    await writeIfSourceExists(carSlug, designSlug);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
