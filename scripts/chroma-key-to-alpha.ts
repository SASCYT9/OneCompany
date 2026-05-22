import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

type Args = { input: string; output: string };

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) continue;
    i += 1;
    if (key === "input") args.input = value;
    if (key === "output") args.output = value;
  }
  if (!args.input) throw new Error("Missing --input <file>");
  if (!args.output) throw new Error("Missing --output <file>");
  return { input: args.input, output: args.output };
}

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function computeAlpha(r: number, g: number, b: number) {
  // Heuristic tuned for #00ff00 chroma backgrounds:
  // - solid green becomes transparent
  // - near-edge pixels get partial alpha to avoid jaggies
  const maxRB = Math.max(r, b);
  const greenDiff = g - maxRB; // larger = more likely background

  if (g < 90) return 255;

  // Fully transparent.
  if (greenDiff >= 110 && r <= 110 && b <= 110) return 0;

  // Soft edge band.
  if (greenDiff > 50 && r < 140 && b < 140) {
    // greenDiff: 50..110 => alpha: 255..0
    const t = (greenDiff - 50) / 60;
    return clampByte(255 * (1 - t));
  }

  return 255;
}

async function main() {
  const { input, output } = parseArgs(process.argv);

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += info.channels) {
    const r = out[i] ?? 0;
    const g = out[i + 1] ?? 0;
    const b = out[i + 2] ?? 0;
    const a = computeAlpha(r, g, b);
    out[i + 3] = a;

    // Despill edges: when partially keyed, reduce green dominance.
    if (a < 255 && a > 0) {
      const maxRB = Math.max(r, b);
      out[i + 1] = clampByte(Math.min(g, maxRB + 6));
    }
  }

  await ensureDir(output);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(output);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
