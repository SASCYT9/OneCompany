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

const candidates = [
  {
    name: "bmw-s1000rr.png",
    url: "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/22677/cb4470e0-4342-4044-8590-49037d6ea8fb.png",
  },
  {
    name: "yamaha-r1.png",
    url: "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/20736/7b0c3035-7c3f-4c30-a771-51e1905c497f.png",
  },
  {
    name: "kawasaki-zx10r.png",
    url: "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/21275/a2e5dd4d-709b-473b-822e-d1b480273c27.png",
  },
  {
    name: "bmw-r1300gs.png",
    url: "https://d1sfhav1wboke3.azureedge.net/ImageServer/Apim2Media/Images/22130/90dbae92-7318-4369-9dfb-542913a8397c.png",
  },
];

async function main() {
  for (const c of candidates) {
    const pngPath = path.join(destDir, c.name);
    console.log(`Downloading ${c.name} from ${c.url}...`);
    try {
      await download(c.url, pngPath);
      console.log(`  Downloaded successfully!`);

      const webpName = `${path.basename(c.name, ".png")}.webp`;
      const webpPath = path.join(destDir, webpName);

      console.log(`  Compressing ${c.name} to WebP...`);
      await sharp(pngPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(webpPath);

      const origSize = fs.statSync(pngPath).size;
      const compSize = fs.statSync(webpPath).size;
      console.log(
        `  Compressed: ${(origSize / 1024 / 1024).toFixed(2)} MB -> ${(compSize / 1024).toFixed(1)} KB`
      );

      // Move original png to originals directory
      const origPngPath = path.join(origDir, c.name);
      if (fs.existsSync(origPngPath)) {
        fs.unlinkSync(origPngPath);
      }
      fs.renameSync(pngPath, origPngPath);
      console.log(`  Moved original to originals/${c.name}`);
    } catch (e) {
      console.error(`  Error processing ${c.name}: ${e.message}`);
    }
  }
}

main();
