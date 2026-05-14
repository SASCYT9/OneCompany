import sharp from "sharp";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TMP = join(ROOT, "tmp", "hero-mono");
mkdirSync(TMP, { recursive: true });

// Pull v2 (stone-wall variants with orange ambient strip) straight from git so
// we always start from the canonical bytes regardless of working-tree state.
const v2 = {
  "hero-auto-v2-source.png": "2b857be9:public/images/hero-auto.png",
  "hero-moto-v2-source.png": "2b857be9:public/images/hero-moto.png",
};
for (const [name, ref] of Object.entries(v2)) {
  execSync(`git show ${ref} > "${join(TMP, name)}"`, { stdio: "inherit" });
}

const targets = [
  { in: "hero-auto-v2-source.png", out: "public/images/hero-auto-mono.png" },
  { in: "hero-moto-v2-source.png", out: "public/images/hero-moto-mono.png" },
];

for (const t of targets) {
  await sharp(join(TMP, t.in))
    .greyscale()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(join(ROOT, t.out));
  console.log(`wrote ${t.out}`);
}
