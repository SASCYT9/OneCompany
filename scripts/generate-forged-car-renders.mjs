import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const workspaceRoot = process.cwd();

const DESIGN_SLUGS = [
  "forged-spoke-pro",
  "forged-mesh-x",
  "forged-heritage-5",
  "forged-splitline",
  "forged-twin-spoke",
];

const MATERIALS = ["aluminium", "magnesium", "carbon"];

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function compositeWheel(baseImagePath, wheelPngPath, placement) {
  const base = sharp(baseImagePath);
  const meta = await base.metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read image metadata: ${baseImagePath}`);
  }

  const diameterPx = Math.round(placement.r * 2 * meta.width);
  const centerX = Math.round(placement.x * meta.width);
  const centerY = Math.round(placement.y * meta.height);

  const left = Math.round(centerX - diameterPx / 2);
  const top = Math.round(centerY - diameterPx / 2);

  const wheelBuffer = await sharp(wheelPngPath).resize(diameterPx, diameterPx).toBuffer();

  return sharp(await base.toBuffer()).composite([
    {
      input: wheelBuffer,
      left,
      top,
    },
  ]);
}

async function generateRender({ baseImagePath, outPath, wheelPngPath, wheelFront, wheelRear }) {
  assertExists(baseImagePath);
  assertExists(wheelPngPath);
  ensureDir(path.dirname(outPath));

  const withFront = await compositeWheel(baseImagePath, wheelPngPath, wheelFront);
  const withBoth = await compositeWheel(
    await withFront.jpeg({ quality: 95 }).toBuffer(),
    wheelPngPath,
    wheelRear
  );

  await withBoth.jpeg({ quality: 92, mozjpeg: true }).toFile(outPath);
}

async function main() {
  const carSlug = process.argv[2];
  if (!carSlug) {
    console.error("Usage: node scripts/generate-forged-car-renders.mjs <carSlug>");
    process.exit(1);
  }

  // This script is intentionally scoped to one car at a time.
  // For MVP, we keep the placements inline to avoid TS importing complexity.
  // If more cars need generation, add another entry.
  const placementsByCar = {
    "toyota-supra-a90": {
      wheelFront: { x: 0.24, y: 0.66, r: 0.084 },
      wheelRear: { x: 0.79, y: 0.66, r: 0.084 },
      baseImagePath: path.join(
        workspaceRoot,
        "public",
        "forged",
        "renders",
        "toyota-supra-a90",
        "forged-spoke-pro",
        "aluminium.jpg"
      ),
    },
  };

  const config = placementsByCar[carSlug];
  if (!config) {
    console.error(`Unknown carSlug: ${carSlug}`);
    console.error(`Known carSlugs: ${Object.keys(placementsByCar).join(", ")}`);
    process.exit(1);
  }

  const missing = [];
  for (const designSlug of DESIGN_SLUGS) {
    for (const material of MATERIALS) {
      const relOut = path.join(
        "public",
        "forged",
        "renders",
        carSlug,
        designSlug,
        `${material}.jpg`
      );
      const outPath = path.join(workspaceRoot, relOut);
      if (!fs.existsSync(outPath)) {
        missing.push({ designSlug, material, outPath });
      }
    }
  }

  if (missing.length === 0) {
    console.log(`No missing renders for ${carSlug}.`);
    return;
  }

  console.log(`Generating ${missing.length} missing renders for ${carSlug}…`);

  for (const item of missing) {
    const wheelPngPath = path.join(
      workspaceRoot,
      "public",
      "forged",
      "designs",
      item.designSlug,
      "materials",
      item.material,
      "wheel.png"
    );

    await generateRender({
      baseImagePath: config.baseImagePath,
      outPath: item.outPath,
      wheelPngPath,
      wheelFront: config.wheelFront,
      wheelRear: config.wheelRear,
    });

    console.log(`- wrote ${path.relative(workspaceRoot, item.outPath)}`);
  }
}

await main();
