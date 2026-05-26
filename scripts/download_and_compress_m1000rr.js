const https = require("https");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        },
        (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Status code: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        }
      )
      .on("error", reject);
  });
}

const destDir = path.join(__dirname, "..", "public", "images", "shop", "akrapovic");
const origDir = path.join(destDir, "originals");

if (!fs.existsSync(origDir)) {
  fs.mkdirSync(origDir, { recursive: true });
}

async function main() {
  const url =
    "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/22679/cb4470e0-4342-4044-8590-49037d6ea8fb.png";
  const pngPath = path.join(origDir, "bmw-m1000rr.png");
  const webpPath = path.join(destDir, "bmw-m1000rr.webp");

  console.log(`Downloading BMW M 1000 RR image to ${pngPath}...`);
  try {
    await download(url, pngPath);
    console.log(`  Downloaded successfully!`);

    console.log(`  Compressing to WebP at ${webpPath}...`);
    await sharp(pngPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(webpPath);

    const origSize = fs.statSync(pngPath).size;
    const compSize = fs.statSync(webpPath).size;
    console.log(
      `  Compressed: ${(origSize / 1024 / 1024).toFixed(2)} MB -> ${(compSize / 1024).toFixed(1)} KB`
    );
  } catch (e) {
    console.error(`  Error: ${e.message}`);
  }
}

main();
