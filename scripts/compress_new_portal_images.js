const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const srcAuto =
  "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\akrapovic_auto_bg_1779615066484.png";
const srcMoto =
  "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\akrapovic_moto_bg_1779615086941.png";

const destDir = path.join(__dirname, "..", "public", "images", "shop", "akrapovic");

async function compress(src, destName) {
  if (!fs.existsSync(src)) {
    console.error(`Source file does not exist: ${src}`);
    return;
  }
  const destPath = path.join(destDir, destName);
  console.log(`Compressing ${src} to ${destName}...`);
  try {
    await sharp(src)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(destPath);
    console.log(
      `  Compressed successfully! Saved to ${destPath} (${fs.statSync(destPath).size} bytes)`
    );
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }
}

async function main() {
  await compress(srcAuto, "portal-auto.webp");
  await compress(srcMoto, "portal-moto.webp");
}

main();
