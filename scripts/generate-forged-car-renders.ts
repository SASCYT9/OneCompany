import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { CAR_LIBRARY } from "@/lib/forged/carLibrary";

type Args = {
  car: string;
  base: string;
  width: number;
  height: number;
};

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const WHEEL_FIT = 198;

const DESIGN_SLUGS = [
  "forged-spoke-pro",
  "forged-mesh-x",
  "forged-heritage-5",
  "forged-splitline",
  "forged-twin-spoke",
] as const;

const MATERIALS = ["aluminium", "magnesium", "carbon"] as const;

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) continue;
    i += 1;
    if (key === "car") args.car = value;
    if (key === "base") args.base = value;
    if (key === "width") args.width = Number(value);
    if (key === "height") args.height = Number(value);
  }

  if (!args.car) throw new Error("Missing --car <carSlug>");
  if (!args.base) throw new Error("Missing --base <pathToBackdropImage>");
  return {
    car: args.car,
    base: args.base,
    width: Number.isFinite(args.width) ? (args.width as number) : DEFAULT_WIDTH,
    height: Number.isFinite(args.height) ? (args.height as number) : DEFAULT_HEIGHT,
  };
}

function wheelDiameterPx(maskR: number, width: number) {
  return Math.max(1, Math.round((maskR * WHEEL_FIT * width) / 100));
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const { car: carSlug, base: basePath, width, height } = parseArgs(process.argv);

  const car = CAR_LIBRARY.find((entry) => entry.slug === carSlug);
  if (!car) {
    throw new Error(`Unknown car slug: ${carSlug}`);
  }

  const base = sharp(basePath).resize(width, height, { fit: "cover" });
  const baseBuffer = await base.jpeg({ quality: 92 }).toBuffer();

  for (const designSlug of DESIGN_SLUGS) {
    for (const material of MATERIALS) {
      const wheelPath = path.join(
        process.cwd(),
        "public",
        "forged",
        "designs",
        designSlug,
        "materials",
        material,
        "wheel.png"
      );

      const diameterFront = wheelDiameterPx(car.wheelMaskFront.r, width);
      const diameterRear = wheelDiameterPx(car.wheelMaskRear.r, width);

      const wheelFront = await sharp(wheelPath).resize(diameterFront, diameterFront).toBuffer();
      const wheelRear = await sharp(wheelPath).resize(diameterRear, diameterRear).toBuffer();

      const leftFront = Math.round(car.wheelMaskFront.x * width - diameterFront / 2);
      const topFront = Math.round(car.wheelMaskFront.y * height - diameterFront / 2);
      const leftRear = Math.round(car.wheelMaskRear.x * width - diameterRear / 2);
      const topRear = Math.round(car.wheelMaskRear.y * height - diameterRear / 2);

      const outDir = path.join(process.cwd(), "public", "forged", "renders", carSlug, designSlug);
      await ensureDir(outDir);

      const outPath = path.join(outDir, `${material}.jpg`);
      await sharp(baseBuffer)
        .composite([
          { input: wheelFront, left: leftFront, top: topFront },
          { input: wheelRear, left: leftRear, top: topRear },
        ])
        .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
        .toFile(outPath);
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
