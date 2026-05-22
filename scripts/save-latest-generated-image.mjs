import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name));
}

function listPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPngs(full));
    else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".png") &&
      entry.name.startsWith("ig_")
    )
      out.push(full);
  }
  return out;
}

function newestFile(files) {
  let newest = null;
  let newestMs = -1;
  for (const file of files) {
    const stat = fs.statSync(file);
    const ms = stat.mtimeMs;
    if (ms > newestMs) {
      newest = file;
      newestMs = ms;
    }
  }
  return newest;
}

async function main() {
  const output = process.argv[2];
  if (!output) {
    console.error("Usage: node scripts/save-latest-generated-image.mjs <output-path>");
    process.exit(1);
  }

  const base = path.join(os.homedir(), ".codex", "generated_images");
  if (!fs.existsSync(base)) {
    console.error(`Missing generated images dir: ${base}`);
    process.exit(1);
  }

  const dirs = listDirs(base);
  if (!dirs.length) {
    console.error(`No subdirectories in: ${base}`);
    process.exit(1);
  }

  const pngs = dirs.flatMap((d) => listPngs(d));
  const latest = newestFile(pngs);
  if (!latest) {
    console.error(`No ig_*.png found under: ${base}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(latest)
    .resize(1600, 1000, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toFile(output);
  console.log(`Saved latest generated image -> ${output}`);
  console.log(`Source: ${latest}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
