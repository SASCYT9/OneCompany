const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const images = [
  "ducati-panigale-v2.png",
  "bmw-s1000rr.png",
  "yamaha-r1.png",
  "kawasaki-zx10r.png",
  "bmw-r1300gs.png",
];

async function main() {
  const dir = "d:\\One Company\\OneCompany\\public\\images\\shop\\akrapovic";
  const origDir = path.join(dir, "originals");

  if (!fs.existsSync(origDir)) {
    fs.mkdirSync(origDir, { recursive: true });
  }

  for (const name of images) {
    const srcPath = path.join(dir, name);
    if (!fs.existsSync(srcPath)) {
      console.error(`File does not exist: ${srcPath}`);
      continue;
    }

    const baseName = path.basename(name, ".png");
    const destName = `${baseName}.webp`;
    const destPath = path.join(dir, destName);

    console.log(`Compressing ${name} to WebP...`);

    // We will resize to max 1200px width (keeping aspect ratio)
    // and convert to webp with quality 75.
    try {
      await sharp(srcPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(destPath);

      const origSize = fs.statSync(srcPath).size;
      const compSize = fs.statSync(destPath).size;

      console.log(`  Compressed! Saved to ${destName}`);
      console.log(
        `  Size: ${(origSize / 1024 / 1024).toFixed(2)} MB -> ${(compSize / 1024).toFixed(1)} KB`
      );

      // Move original to originals folder
      const origDestPath = path.join(origDir, name);
      fs.renameSync(srcPath, origDestPath);
      console.log(`  Moved original to originals/${name}`);
    } catch (err) {
      console.error(`  Error compressing ${name}:`, err.message);
    }
  }
}

main();
